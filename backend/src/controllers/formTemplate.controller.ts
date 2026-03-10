import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../config/database';
import { AppError } from '../utils/error.utils';

export const getFormTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Autenticación requerida.', 401);
    }

    // Permitir acceso a todos los roles autenticados (DOCTOR, ASISTENTE, PATIENT)
    // Buscar todas las plantillas de formulario, sin filtrar por especialidad
    const templates = await prisma.formTemplate.findMany({
      include: {
        fields: { // Incluir los campos de cada plantilla
          orderBy: {
            order: 'asc' // Asegurarse de que los campos vengan en el orden correcto
          }
        }
      }
    });

    // Definir orden lógico de visualización: primero formularios generales, luego especialidades, luego laboratorios
    const displayOrder: { [key: string]: number } = {
      // Formularios generales (prioridad alta)
      'Datos médicos generales': 1,
      'Esquema de vacunación': 2,
      // Especialidades médicas (3-30, orden alfabético)
      'Alergología e Inmunología': 3,
      'Anestesiología': 4,
      'Cardiología': 5,
      'Cirugía General': 6,
      'Dermatología': 7,
      'Endocrinología': 8,
      'Evaluación de Heridas': 9,
      'Evaluación de Estomas': 10,
      'Evaluación de Quemaduras': 11,
      'Gastroenterología': 12,
      'Geriatría': 13,
      'Ginecología y Obstetricia': 14,
      'Hematología': 15,
      'Infectología': 16,
      'Medicina Interna': 17,
      'Nefrología': 18,
      'Neumología': 19,
      'Neurología': 20,
      'Oftalmología': 21,
      'Oncología': 22,
      'Ortopedia': 23,
      'Otorrinolaringología': 24,
      'Pediatría': 25,
      'Psicología': 26,
      'Psiquiatría': 27,
      'Radiología': 28,
      'Traumatología': 29,
      'Odontología': 30,
      'Internista': 31,
      // Exámenes de laboratorio (32-41, orden lógico de uso)
      'Examen general de orina': 32,
      'Biometría hemática (Hemograma completo)': 33,
      'Química sanguínea completa': 34,
      'Hemoglobina glicosilada (HbA1c)': 35,
      'Perfil tiroideo': 36,
      'Perfil lipídico': 37,
      'Función renal': 38,
      'Función hepática': 39,
      'Coagulación': 40,
      'Perfil de anemias': 41,
    };

    // Ordenar templates según el orden definido, si no está en la lista, va al final alfabéticamente
    const sortedTemplates = templates.sort((a, b) => {
      const orderA = displayOrder[a.name] ?? 999;
      const orderB = displayOrder[b.name] ?? 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Si no tienen orden definido, ordenar alfabéticamente
      return a.name.localeCompare(b.name, 'es');
    });

    res.status(200).json(sortedTemplates);

  } catch (error: any) {
    console.error("Error al obtener plantillas de formulario:", error);
    const handledError = error instanceof AppError ? error : new AppError('Error interno al obtener las plantillas.', 500);
    res.status(handledError.statusCode).json({ message: handledError.message });
  }
}; 