import { PrismaClient, UserRole } from '@prisma/client';
import { seedLabAnalyteCatalog } from './seeds/labAnalyteCatalog.seed';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // ⚠️ IMPORTANTE: Este seed NO elimina datos existentes para evitar pérdida de información
    // Solo crea datos si no existen. Para limpiar y recrear todo, usar scripts específicos:
    // - scripts/seed-test-users.js (elimina y recrea usuarios de prueba)
    // - scripts/migrate-test-users.js (elimina y recrea usuarios de prueba)

    const hashedPassword = await bcrypt.hash('12345678', 10);

    // --- Creación del Doctor de Prueba (solo si no existe) ---
    let doctorUser = await prisma.user.findUnique({
        where: { email: 'doctor@test.com' }
    });

    if (!doctorUser) {
        doctorUser = await prisma.user.create({
            data: {
                email: 'doctor@test.com',
                password: hashedPassword,
                firstName: 'Doctor',
                lastName: 'Prueba',
                role: UserRole.DOCTOR,
            },
        });
        console.log(`Created doctor user: ${doctorUser.email}`);
    } else {
        console.log(`Doctor user already exists: ${doctorUser.email}`);
    }

    let doctor = await prisma.doctor.findUnique({
        where: { userId: doctorUser.id }
    });

    if (!doctor) {
        doctor = await prisma.doctor.create({
            data: {
                userId: doctorUser.id,
                licenseNumber: '12345678',
                specialization: 'Cardiología',
                officeAddress: 'Av. Siempre Viva 123',
                officePhone: '5512345678',
                professionalTitle: 'Especialista en Cardiología',
                taxId: 'XAXX010101000',
                taxName: 'Servicios Médicos de Prueba S.A. de C.V.',
                taxAddress: 'Av. Fiscal 123',
                taxCertificateUrl: 'https://example.com/tax.pdf',
                dataConsent: true,
                termsAccepted: true,
                termsAcceptedAt: new Date(),
                // LIFETIME en local: evita bloqueos de suscripción/PayPal al probar
                accessType: 'lifetime',
            },
        });
        console.log(`Created doctor profile for: ${doctorUser.email}`);
    } else {
        console.log(`Doctor user already exists: ${doctorUser.email}`);
        if ((doctor.accessType || '').toLowerCase() !== 'lifetime') {
            doctor = await prisma.doctor.update({
                where: { id: doctor.id },
                data: { accessType: 'lifetime' },
            });
            console.log(`Updated doctor accessType to lifetime: ${doctorUser.email}`);
        }
    }

    // Suscripción LIFETIME (sin PayPal): mismo patrón que promo LIFETIME en registro
    const lifetimeEnd = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    const existingSubscription = await prisma.subscription.findFirst({
        where: { doctorId: doctor.id }
    });

    if (!existingSubscription) {
        await prisma.subscription.create({
            data: {
                doctorId: doctor.id,
                status: 'ACTIVE',
                startDate: new Date(),
                endDate: lifetimeEnd,
                paypalSubscriptionId: '',
                paypalPlanId: '',
                freeMonthUsed: false,
            },
        });
        console.log(`Created LIFETIME subscription for doctor: ${doctorUser.email}`);
    } else {
        await prisma.subscription.update({
            where: { id: existingSubscription.id },
            data: {
                status: 'ACTIVE',
                endDate: lifetimeEnd,
                paypalSubscriptionId: '',
                paypalPlanId: '',
                cancelledAt: null,
                cancellationReason: null,
                freeMonthUsed: false,
                resumeDate: null,
            },
        });
        console.log(`Updated subscription to LIFETIME for doctor: ${doctorUser.email}`);
    }

    // --- Creación del Paciente de Prueba (solo si no existe) ---
    let patientUser = await prisma.user.findUnique({
        where: { email: 'paciente@test.com' }
    });

    if (!patientUser) {
        patientUser = await prisma.user.create({
            data: {
                email: 'paciente@test.com',
                password: hashedPassword,
                firstName: 'Paciente',
                lastName: 'Prueba',
                role: UserRole.PATIENT,
            },
        });
        console.log(`Created patient user: ${patientUser.email}`);
    } else {
        console.log(`Patient user already exists: ${patientUser.email}`);
    }

    let patient = await prisma.patient.findUnique({
        where: { userId: patientUser.id }
    });

    if (!patient) {
        patient = await prisma.patient.create({
            data: {
                userId: patientUser.id,
                firstName: 'Paciente',
                lastName: 'Prueba',
                dateOfBirth: new Date('1990-01-01'),
                gender: 'MALE',
                dataConsent: true,
                dataConsentAt: new Date(),
            },
        });
        console.log(`Created patient profile: ${patientUser.email}`);
    } else {
        console.log(`Patient profile already exists: ${patientUser.email}`);
    }
    
    // --- Creación de relación Doctor-Paciente (solo si no existe) ---
    const existingRelation = await prisma.doctorPatient.findFirst({
        where: {
            doctorId: doctor.id,
            patientId: patient.id
        }
    });

    if (!existingRelation) {
        await prisma.doctorPatient.create({
            data: {
                doctorId: doctor.id,
                patientId: patient.id,
                status: 'ACTIVE',
                context: 'Consulta general',
                specialization: 'Cardiología',
                startDate: new Date(),
            },
        });
        console.log(`Created doctor-patient relationship`);
    } else {
        console.log(`Doctor-patient relationship already exists`);
    }
    
    // Plantillas de formularios de especialidad (versión robusta / PROD):
    // NO se cargan aquí. Tras `npm run db:seed`, ejecutar:
    //   npm run db:seed:forms
    // Ver: scripts/seed-form-templates-only.js y SEED_FORMULARIOS_PROD.md
    console.log('Form templates: run `npm run db:seed:forms` for PROD specialty templates.');

    await seedLabAnalyteCatalog(prisma);
    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });