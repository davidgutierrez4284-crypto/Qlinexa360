import * as cron from 'node-cron';
import { runResumeSuspendedSubscriptions } from '../../controllers/subscription.controller';
import { securityLogger } from '../../utils/logger.utils';

/**
 * Cron que reanuda suscripciones cuyo mes gratis ya terminó (resumeDate <= hoy).
 * Corre diariamente a las 6:00 AM (hora del servidor).
 */
export class SubscriptionResumeCron {
  private static job: cron.ScheduledTask | null = null;

  static start() {
    if (!this.job) {
      this.job = cron.schedule('0 6 * * *', () => this.run());
      securityLogger.info('Cron de reanudación de suscripciones (mes gratis) programado (diario 6:00 AM)');
    }
  }

  static stop() {
    this.job?.stop();
    this.job = null;
  }

  private static async run() {
    try {
      const { count, results } = await runResumeSuspendedSubscriptions();
      if (count > 0) {
        const resumed = results.filter((r: any) => r.status === 'resumed');
        const errors = results.filter((r: any) => r.status === 'error');
        securityLogger.info(
          `Cron reanudación suscripciones: ${count} procesadas, ${resumed.length} reanudadas, ${errors.length} errores`
        );
        if (errors.length > 0) {
          securityLogger.warn('Errores en reanudación:', JSON.stringify(errors));
        }
      }
    } catch (error) {
      securityLogger.error('Error en cron de reanudación de suscripciones:', error);
    }
  }
}

export default SubscriptionResumeCron;
