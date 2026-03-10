/**
 * Script para borrar pacientes de la base de datos por email
 * SOLO PARA DESARROLLO/TESTING
 * 
 * Uso: npm run delete:patient email1@example.com email2@example.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deletePatientByEmail(email: string): Promise<boolean> {
  try {
    console.log(`\n🔍 Buscando paciente con email: ${email}`);
    
    // Buscar el User por email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        patientProfile: {
          include: {
            appointments: true,
            medicalRecords: true,
            prescriptions: true,
            recetasMedicas: true,
            files: true,
            invoices: true,
            clinicalCases: true,
            doctors: true,
            emergencyContacts: true,
            insurancePolicies: true,
            internalCalendarEvents: true,
            waitlistEntries: true,
            colaboraciones: true
          }
        }
      }
    });

    if (!user) {
      console.log(`❌ No se encontró usuario con email: ${email}`);
      return false;
    }

    if (user.role !== 'PATIENT') {
      console.log(`⚠️  El usuario ${email} no es un paciente (rol: ${user.role})`);
      return false;
    }

    if (!user.patientProfile) {
      console.log(`⚠️  El usuario ${email} no tiene perfil de paciente`);
      return false;
    }

    const patient = user.patientProfile;
    console.log(`✅ Paciente encontrado: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})`);

    // Mostrar resumen de datos a borrar
    console.log(`\n📊 Resumen de datos a borrar:`);
    console.log(`   - Citas: ${patient.appointments.length}`);
    console.log(`   - Registros médicos: ${patient.medicalRecords.length}`);
    console.log(`   - Recetas: ${patient.recetasMedicas.length}`);
    console.log(`   - Prescripciones: ${patient.prescriptions.length}`);
    console.log(`   - Archivos: ${patient.files.length}`);
    console.log(`   - Facturas: ${patient.invoices.length}`);
    console.log(`   - Casos clínicos: ${patient.clinicalCases.length}`);
    console.log(`   - Eventos de calendario: ${patient.internalCalendarEvents.length}`);
    console.log(`   - Contactos de emergencia: ${patient.emergencyContacts.length}`);
    console.log(`   - Pólizas de seguro: ${patient.insurancePolicies.length}`);
    console.log(`   - Relaciones con doctores: ${patient.doctors.length}`);

    // Borrar en orden (de dependientes a principales)
    console.log(`\n🗑️  Iniciando borrado...`);

    // 1. Borrar PreConsultations (si el modelo existe)
    try {
      const preConsultations = await (prisma as any).preConsultation?.findMany({
        where: { patientId: patient.id }
      });
      if (preConsultations && preConsultations.length > 0) {
        await (prisma as any).preConsultation.deleteMany({
          where: { patientId: patient.id }
        });
        console.log(`   ✅ Pre-consultas borradas`);
      }
    } catch (error) {
      // Si el modelo no existe, continuar
      console.log(`   ⚠️  Pre-consultas: modelo no disponible`);
    }

    // 2. Borrar WaitlistEntries
    if (patient.waitlistEntries.length > 0) {
      await prisma.waitlistEntry.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Entradas de lista de espera borradas`);
    }

    // 3. Borrar Appointments
    if (patient.appointments.length > 0) {
      await prisma.appointment.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Citas borradas`);
    }

    // 4. Borrar MedicalRecords
    if (patient.medicalRecords.length > 0) {
      await prisma.medicalRecord.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Registros médicos borrados`);
    }

    // 5. Borrar Prescriptions
    if (patient.prescriptions.length > 0) {
      await prisma.prescription.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Prescripciones borradas`);
    }

    // 6. Borrar RecetasMedicas
    if (patient.recetasMedicas.length > 0) {
      await prisma.recetaMedica.deleteMany({
        where: { pacienteId: patient.id }
      });
      console.log(`   ✅ Recetas médicas borradas`);
    }

    // 7. Borrar Files relacionados con el paciente
    if (patient.files.length > 0) {
      await prisma.file.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Archivos borrados`);
    }

    // 8. Borrar Invoices
    if (patient.invoices.length > 0) {
      await prisma.invoice.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Facturas borradas`);
    }

    // 9. Borrar ClinicalCases
    if (patient.clinicalCases.length > 0) {
      await prisma.clinicalCase.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Casos clínicos borrados`);
    }

    // 10. Borrar InternalCalendarEvents
    if (patient.internalCalendarEvents.length > 0) {
      await prisma.internalCalendarEvent.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Eventos de calendario borrados`);
    }

    // 11. Borrar EmergencyContacts
    if (patient.emergencyContacts.length > 0) {
      await prisma.emergencyContact.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Contactos de emergencia borrados`);
    }

    // 12. Borrar PatientInsurance
    if (patient.insurancePolicies.length > 0) {
      await prisma.patientInsurance.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Pólizas de seguro borradas`);
    }

    // 13. Borrar PadecimientoDoctorColaborador
    if (patient.colaboraciones.length > 0) {
      await prisma.padecimientoDoctorColaborador.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Colaboraciones borradas`);
    }

    // 14. Borrar DoctorPatient
    if (patient.doctors.length > 0) {
      await prisma.doctorPatient.deleteMany({
        where: { patientId: patient.id }
      });
      console.log(`   ✅ Relaciones con doctores borradas`);
    }

    // 15. Borrar Notifications relacionadas
    await prisma.notification.deleteMany({
      where: { userId: user.id }
    });
    console.log(`   ✅ Notificaciones borradas`);

    // 16. Borrar PasswordResetTokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });
    console.log(`   ✅ Tokens de reset de contraseña borrados`);

    // 17. Borrar FileAccessLogs
    await prisma.fileAccessLog.deleteMany({
      where: { userId: user.id }
    });
    console.log(`   ✅ Logs de acceso a archivos borrados`);

    // 18. Borrar ConsentHistory
    await prisma.consentHistory.deleteMany({
      where: { userId: user.id }
    });
    console.log(`   ✅ Historial de consentimiento borrado`);

    // 19. Borrar el Patient
    await prisma.patient.delete({
      where: { id: patient.id }
    });
    console.log(`   ✅ Perfil de paciente borrado`);

    // 20. Finalmente, borrar el User
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log(`   ✅ Usuario borrado`);

    console.log(`\n✅ Paciente ${email} borrado exitosamente`);
    return true;

  } catch (error: any) {
    console.error(`\n❌ Error al borrar paciente ${email}:`, error);
    throw error;
  }
}

async function main() {
  const emails = process.argv.slice(2);

  if (emails.length === 0) {
    console.log('❌ Por favor, proporciona al menos un email de paciente a borrar');
    console.log('Uso: npm run delete:patient email1@example.com email2@example.com');
    process.exit(1);
  }

  console.log('⚠️  ADVERTENCIA: Este script borrará PERMANENTEMENTE los pacientes y todos sus datos relacionados.');
  console.log(`📧 Emails a borrar: ${emails.join(', ')}`);
  console.log('\nPresiona Ctrl+C para cancelar o espera 3 segundos para continuar...\n');

  // Esperar 3 segundos para dar tiempo a cancelar
  await new Promise(resolve => setTimeout(resolve, 3000));

  let successCount = 0;
  let failCount = 0;

  for (const email of emails) {
    try {
      const success = await deletePatientByEmail(email);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error: any) {
      console.error(`Error procesando ${email}:`, error.message);
      failCount++;
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ Borrados exitosamente: ${successCount}`);
  console.log(`   ❌ Fallos: ${failCount}`);

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });

