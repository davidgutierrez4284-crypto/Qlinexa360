#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { securityLogger } = require('../dist/utils/logger.utils');

const execAsync = promisify(exec);

class BackupManager {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.dbBackupDir = path.join(this.backupDir, 'database');
    this.filesBackupDir = path.join(this.backupDir, 'files');
    this.logsBackupDir = path.join(this.backupDir, 'logs');
  }

  async ensureDirectories() {
    const dirs = [this.backupDir, this.dbBackupDir, this.filesBackupDir, this.logsBackupDir];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
      }
    }
  }

  async backupDatabase() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `medilink360_db_${timestamp}.sql`;
      const filepath = path.join(this.dbBackupDir, filename);

      // Usar pg_dump para PostgreSQL
      const command = `pg_dump "${process.env.DATABASE_URL}" > "${filepath}"`;
      
      console.log('Starting database backup...');
      await execAsync(command);
      
      // Comprimir el backup
      const compressedFile = `${filepath}.gz`;
      await execAsync(`gzip "${filepath}"`);
      
      const stats = await fs.stat(compressedFile);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`Database backup completed: ${compressedFile} (${sizeMB} MB)`);
      
      // Limpiar backups antiguos (mantener solo los últimos 7 días)
      await this.cleanOldBackups(this.dbBackupDir, 7);
      
      return { success: true, file: compressedFile, size: sizeMB };
      
    } catch (error) {
      console.error('Database backup failed:', error);
      securityLogger.error('Database backup failed', error);
      return { success: false, error: error.message };
    }
  }

  async backupFiles() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `medilink360_files_${timestamp}.tar.gz`;
      const filepath = path.join(this.filesBackupDir, filename);

      // Backup de archivos subidos (si están en local)
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      if (await this.directoryExists(uploadsDir)) {
        console.log('Starting files backup...');
        await execAsync(`tar -czf "${filepath}" -C "${uploadsDir}" .`);
        
        const stats = await fs.stat(filepath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`Files backup completed: ${filepath} (${sizeMB} MB)`);
        
        // Limpiar backups antiguos
        await this.cleanOldBackups(this.filesBackupDir, 7);
        
        return { success: true, file: filepath, size: sizeMB };
      } else {
        console.log('No local uploads directory found, skipping files backup');
        return { success: true, skipped: true };
      }
      
    } catch (error) {
      console.error('Files backup failed:', error);
      securityLogger.error('Files backup failed', error);
      return { success: false, error: error.message };
    }
  }

  async backupLogs() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `medilink360_logs_${timestamp}.tar.gz`;
      const filepath = path.join(this.logsBackupDir, filename);

      const logsDir = path.join(process.cwd(), 'logs');
      
      if (await this.directoryExists(logsDir)) {
        console.log('Starting logs backup...');
        await execAsync(`tar -czf "${filepath}" -C "${logsDir}" .`);
        
        const stats = await fs.stat(filepath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`Logs backup completed: ${filepath} (${sizeMB} MB)`);
        
        // Limpiar backups antiguos
        await this.cleanOldBackups(this.logsBackupDir, 30); // Mantener logs por 30 días
        
        return { success: true, file: filepath, size: sizeMB };
      } else {
        console.log('No logs directory found, skipping logs backup');
        return { success: true, skipped: true };
      }
      
    } catch (error) {
      console.error('Logs backup failed:', error);
      securityLogger.error('Logs backup failed', error);
      return { success: false, error: error.message };
    }
  }

  async cleanOldBackups(backupDir, daysToKeep) {
    try {
      const files = await fs.readdir(backupDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      for (const file of files) {
        const filepath = path.join(backupDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filepath);
          console.log(`Deleted old backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning old backups:', error);
    }
  }

  async directoryExists(dir) {
    try {
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }

  async runFullBackup() {
    console.log('Starting full backup process...');
    securityLogger.info('Starting full backup process');
    
    await this.ensureDirectories();
    
    const results = {
      database: await this.backupDatabase(),
      files: await this.backupFiles(),
      logs: await this.backupLogs(),
      timestamp: new Date().toISOString()
    };
    
    // Verificar si todos los backups fueron exitosos
    const allSuccessful = Object.values(results)
      .filter(result => typeof result === 'object' && result !== null)
      .every(result => result.success || result.skipped);
    
    if (allSuccessful) {
      console.log('Full backup completed successfully');
      securityLogger.info('Full backup completed successfully', results);
    } else {
      console.error('Some backups failed');
      securityLogger.error('Some backups failed', results);
    }
    
    return results;
  }
}

// Ejecutar backup si se llama directamente
if (require.main === module) {
  const backupManager = new BackupManager();
  backupManager.runFullBackup()
    .then(results => {
      console.log('Backup results:', JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Backup failed:', error);
      process.exit(1);
    });
}

module.exports = BackupManager; 