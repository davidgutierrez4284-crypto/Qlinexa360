import { PrismaClient, FieldType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type FormFieldData = {
    label: string;
    fieldType: FieldType; 
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
    isRequired: boolean;
    order: number;
};

type FormTemplateData = {
    name: string;
    specialty: string;
    description?: string;
    fields: FormFieldData[];
};

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
                accessType: 'subscription',
            },
        });
        console.log(`Created doctor profile for: ${doctorUser.email}`);
    } else {
        console.log(`Doctor profile already exists for: ${doctorUser.email}`);
    }

    // Crear suscripción solo si no existe
    const existingSubscription = await prisma.subscription.findFirst({
        where: { doctorId: doctor.id }
    });

    if (!existingSubscription) {
        await prisma.subscription.create({
            data: {
                doctorId: doctor.id,
                status: 'ACTIVE',
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                paypalSubscriptionId: 'seed_sub_id_premium',
                paypalPlanId: 'seed_plan_id_premium',
            },
        });
        console.log(`Created subscription for doctor: ${doctorUser.email}`);
    } else {
        console.log(`Subscription already exists for doctor: ${doctorUser.email}`);
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
    
    // --- Creación de Plantillas de Formulario ---
    const formTemplatesData: FormTemplateData[] = [
        {
            name: 'Anestesiología',
            specialty: 'Anestesiología',
            fields: [
                { label: 'Tipo de Cirugía', fieldType: FieldType.TEXT, isRequired: false, order: 1 },
                { label: 'Evaluación Preoperatoria ASA', fieldType: FieldType.SELECT, options: ['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V'], isRequired: false, order: 2 },
                { label: 'Alergias Conocidas', fieldType: FieldType.TEXTAREA, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Cardiología',
            specialty: 'Cardiología',
            fields: [
                { label: 'Presión Arterial (Sistólica)', fieldType: FieldType.NUMBER, isRequired: false, order: 1 },
                { label: 'Presión Arterial (Diastólica)', fieldType: FieldType.NUMBER, isRequired: false, order: 2 },
                { label: 'Colesterol Total (mg/dL)', fieldType: FieldType.NUMBER, isRequired: false, order: 3 },
                { label: 'Antecedentes Familiares', fieldType: FieldType.SELECT, options: ['Sí', 'No', 'No sabe'], isRequired: false, order: 4 },
                { label: 'Observaciones Adicionales', fieldType: FieldType.TEXTAREA, isRequired: false, order: 5 }
            ]
        },
        {
            name: 'Dermatología',
            specialty: 'Dermatología',
            fields: [
                { label: 'Descripción de la Lesión', fieldType: FieldType.TEXTAREA, isRequired: false, order: 1 },
                { label: 'Localización', fieldType: FieldType.TEXT, isRequired: false, order: 2 },
                { label: 'Tratamiento Previo', fieldType: FieldType.TEXT, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Enfermería: Heridas, Estomas y Quemaduras',
            specialty: 'Enfermería: Heridas, Estomas y Quemaduras',
            fields: [
                { label: 'Tipo de Lesión', fieldType: FieldType.SELECT, options: ['Herida', 'Estoma', 'Quemadura'], isRequired: false, order: 1 },
                { label: 'Localización Anatómica', fieldType: FieldType.TEXT, isRequired: false, order: 2 },
                { label: 'Estado de la Piel Perilesional', fieldType: FieldType.TEXTAREA, isRequired: false, order: 3 },
                { label: 'Plan de Cuidados', fieldType: FieldType.TEXTAREA, isRequired: false, order: 4 },
            ]
        },
        {
            name: 'Gastroenterología',
            specialty: 'Gastroenterología',
            fields: [
                { label: 'Síntoma Principal', fieldType: FieldType.TEXT, isRequired: false, order: 1 },
                { label: 'Resultados de Endoscopia', fieldType: FieldType.TEXTAREA, isRequired: false, order: 2 },
                { label: 'Prueba de H. Pylori', fieldType: FieldType.SELECT, options: ['Positivo', 'Negativo', 'No realizada'], isRequired: false, order: 3 },
            ]
        },
         {
            name: 'Ginecología y Obstetricia',
            specialty: 'Ginecología y Obstetricia',
            fields: [
                { label: 'Fecha de Última Menstruación (FUM)', fieldType: FieldType.DATE, isRequired: false, order: 1 },
                { label: 'Resultados de Papanicolau', fieldType: FieldType.TEXTAREA, isRequired: false, order: 2 },
                { label: 'Semanas de Gestación', fieldType: FieldType.NUMBER, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Nefrología',
            specialty: 'Nefrología',
            fields: [
                { label: 'Tasa de Filtración Glomerular (TFG)', fieldType: FieldType.NUMBER, isRequired: false, order: 1 },
                { label: 'Nivel de Creatinina Sérica (mg/dL)', fieldType: FieldType.NUMBER, isRequired: false, order: 2 },
                { label: 'Presencia de Proteinuria', fieldType: FieldType.SELECT, options: ['Sí', 'No'], isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Neurología',
            specialty: 'Neurología',
            fields: [
                { label: 'Escala de Coma de Glasgow (GCS)', fieldType: FieldType.NUMBER, isRequired: false, order: 1 },
                { label: 'Reflejos Osteotendinosos', fieldType: FieldType.TEXT, isRequired: false, order: 2 },
                { label: 'Descripción de Crisis Convulsiva', fieldType: FieldType.TEXTAREA, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Odontología',
            specialty: 'Odontología',
            fields: [
                { label: 'Índice de Placa', fieldType: FieldType.TEXT, isRequired: false, order: 1 },
                { label: 'Plan de Tratamiento Dental', fieldType: FieldType.TEXTAREA, isRequired: false, order: 2 },
                { label: 'Piezas Dentales Afectadas', fieldType: FieldType.TEXT, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Oftalmología',
            specialty: 'Oftalmología',
            fields: [
                { label: 'Agudeza Visual (Ojo Derecho)', fieldType: FieldType.TEXT, isRequired: false, order: 1 },
                { label: 'Agudeza Visual (Ojo Izquierdo)', fieldType: FieldType.TEXT, isRequired: false, order: 2 },
                { label: 'Presión Intraocular (PIO)', fieldType: FieldType.NUMBER, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Otorrinolaringología',
            specialty: 'Otorrinolaringología',
            fields: [
                { label: 'Evaluación Auditiva (Audiometría)', fieldType: FieldType.TEXT, isRequired: false, order: 1 },
                { label: 'Exploración de Faringe', fieldType: FieldType.TEXTAREA, isRequired: false, order: 2 },
                { label: 'Síntomas de Vértigo', fieldType: FieldType.TEXT, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Pediatría',
            specialty: 'Pediatría',
            fields: [
                { label: 'Percentil de Crecimiento (Peso)', fieldType: FieldType.NUMBER, isRequired: false, order: 1 },
                { label: 'Percentil de Crecimiento (Talla)', fieldType: FieldType.NUMBER, isRequired: false, order: 2 },
                { label: 'Esquema de Vacunación', fieldType: FieldType.SELECT, options: ['Completo', 'Incompleto'], isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Psicología',
            specialty: 'Psicología',
            fields: [
                { label: 'Motivo de Consulta', fieldType: FieldType.TEXTAREA, isRequired: false, order: 1 },
                { label: 'Evaluación del Estado de Ánimo', fieldType: FieldType.TEXT, isRequired: false, order: 2 },
                { label: 'Plan Terapéutico', fieldType: FieldType.TEXTAREA, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Psiquiatría',
            specialty: 'Psiquiatría',
            fields: [
                { label: 'Diagnóstico DSM-5', fieldType: FieldType.TEXT, isRequired: false, order: 1 },
                { label: 'Medicación Actual', fieldType: FieldType.TEXTAREA, isRequired: false, order: 2 },
                { label: 'Riesgo Suicida', fieldType: FieldType.SELECT, options: ['Bajo', 'Medio', 'Alto', 'No evaluado'], isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Radiología',
            specialty: 'Radiología',
            fields: [
                { label: 'Tipo de Estudio', fieldType: FieldType.TEXT, isRequired: false, order: 1 },
                { label: 'Hallazgos Radiológicos', fieldType: FieldType.TEXTAREA, isRequired: false, order: 2 },
                { label: 'Impresión Diagnóstica', fieldType: FieldType.TEXTAREA, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Traumatología',
            specialty: 'Traumatología',
            fields: [
                { label: 'Mecanismo de Lesión', fieldType: FieldType.TEXTAREA, isRequired: false, order: 1 },
                { label: 'Rango de Movilidad', fieldType: FieldType.TEXT, isRequired: false, order: 2 },
                { label: 'Plan de Rehabilitación', fieldType: FieldType.TEXTAREA, isRequired: false, order: 3 },
            ]
        },
        {
            name: 'Urología',
            specialty: 'Urología',
            fields: [
                { label: 'Antígeno Prostático Específico (PSA)', fieldType: FieldType.NUMBER, isRequired: false, order: 1 },
                { label: 'Síntomas del Tracto Urinario Inferior (IPSS)', fieldType: FieldType.TEXT, isRequired: false, order: 2 },
                { label: 'Resultados de Uroflujometría', fieldType: FieldType.TEXTAREA, isRequired: false, order: 3 },
            ]
        }
    ];

    for (const templateData of formTemplatesData) {
        const { fields, ...templateDetails } = templateData;
        
        // Verificar si la plantilla ya existe
        let createdTemplate = await prisma.formTemplate.findFirst({
            where: { 
                name: templateDetails.name,
                specialty: templateDetails.specialty
            }
        });

        if (!createdTemplate) {
            createdTemplate = await prisma.formTemplate.create({
                data: templateDetails
            });
            console.log(`Created form template: ${createdTemplate.name}`);
        } else {
            console.log(`Form template already exists: ${createdTemplate.name}`);
        }

        // Crear campos solo si no existen
        if (fields && fields.length > 0) {
            for (const fieldData of fields) {
                const existingField = await prisma.templateField.findFirst({
                    where: {
                        templateId: createdTemplate.id,
                        label: fieldData.label
                    }
                });

                if (!existingField) {
                    await prisma.templateField.create({
                        data: {
                            templateId: createdTemplate.id,
                            label: fieldData.label,
                            fieldType: fieldData.fieldType,
                            placeholder: fieldData.placeholder,
                            options: fieldData.options,
                            defaultValue: fieldData.defaultValue,
                            isRequired: fieldData.isRequired,
                            order: fieldData.order,
                        },
                    });
                }
            }
        }
    }

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