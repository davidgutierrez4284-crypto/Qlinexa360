/**
 * Script para actualizar las etiquetas de campos de Pediatría con unidades de medida.
 * Ejecutar en producción para que las etiquetas muestren las unidades sin re-seedear todo.
 *
 * Uso: node scripts/update-pediatrics-field-labels.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LABEL_UPDATES = [
  { oldLabel: 'Peso', newLabel: 'Peso (kg)' },
  { oldLabel: 'Peso al nacer', newLabel: 'Peso al nacer (g)' },
  { oldLabel: 'Talla', newLabel: 'Talla (cm)' },
  { oldLabel: 'Talla al nacer', newLabel: 'Talla al nacer (cm)' },
  { oldLabel: 'Perímetro cefálico', newLabel: 'Perímetro cefálico (cm)' },
  { oldLabel: 'Edad del paciente (años)', newLabel: 'Edad del paciente (años y meses)' },
  { oldLabel: 'Edad del paciente', newLabel: 'Edad del paciente (años y meses)' },
];

async function updatePediatricsLabels() {
  try {
    const template = await prisma.formTemplate.findFirst({
      where: { specialty: 'PEDIATRIA' },
      include: { fields: true },
    });

    if (!template) {
      console.log('⚠️ No se encontró plantilla de Pediatría. Nada que actualizar.');
      return;
    }

    let updated = 0;
    for (const { oldLabel, newLabel } of LABEL_UPDATES) {
      const field = template.fields.find((f) => f.label === oldLabel);
      if (field) {
        await prisma.templateField.update({
          where: { id: field.id },
          data: { label: newLabel },
        });
        console.log(`✅ ${oldLabel} → ${newLabel}`);
        updated++;
      } else {
        console.log(`⏭️ Campo "${oldLabel}" no encontrado (quizá ya actualizado)`);
      }
    }

    console.log(`\n🎉 Actualizados ${updated} campos de Pediatría.`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updatePediatricsLabels();
