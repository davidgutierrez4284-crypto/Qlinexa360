// Sistema de caché para búsquedas
const searchCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

// Plantillas de prescripciones comunes
export const prescriptionTemplates = [
  // Cardiología
  {
    id: 1,
    name: 'Hipertensión Arterial',
    template: `1. Losartan 50mg - 1 tableta diaria
2. Hidroclorotiazida 25mg - 1 tableta diaria
3. Control de presión arterial cada 8 horas
4. Dieta baja en sodio
5. Ejercicio moderado 30 minutos diarios`,
    category: 'Cardiología'
  },
  {
    id: 2,
    name: 'Insuficiencia Cardíaca',
    template: `1. Furosemida 40mg - 1 tableta diaria
2. Enalapril 10mg - 1 tableta cada 12 horas
3. Espironolactona 25mg - 1 tableta diaria
4. Control de peso diario
5. Restricción de líquidos a 1.5L/día`,
    category: 'Cardiología'
  },
  // Endocrinología
  {
    id: 3,
    name: 'Diabetes Tipo 2',
    template: `1. Metformina 850mg - 1 tableta cada 8 horas
2. Glibenclamida 5mg - 1 tableta cada 12 horas
3. Control de glucemia en ayunas y postprandial
4. Dieta controlada en carbohidratos
5. Ejercicio físico regular`,
    category: 'Endocrinología'
  },
  {
    id: 4,
    name: 'Hipotiroidismo',
    template: `1. Levotiroxina 50mcg - 1 tableta en ayunas
2. Control de TSH cada 3 meses
3. Suplemento de vitamina D si es necesario
4. Dieta rica en yodo
5. Control de peso`,
    category: 'Endocrinología'
  },
  // Neumología
  {
    id: 5,
    name: 'Infección Respiratoria',
    template: `1. Amoxicilina 500mg - 1 tableta cada 8 horas
2. Paracetamol 500mg - 1 tableta cada 8 horas si hay fiebre
3. Reposo relativo
4. Hidratación abundante
5. Control de temperatura`,
    category: 'Neumología'
  },
  {
    id: 6,
    name: 'Asma Bronquial',
    template: `1. Salbutamol inhalador - 2 puff cada 4-6 horas
2. Budesonida inhalador - 2 puff cada 12 horas
3. Control de flujo espiratorio máximo
4. Evitar desencadenantes
5. Técnica inhalatoria correcta`,
    category: 'Neumología'
  },
  // Psiquiatría
  {
    id: 7,
    name: 'Ansiedad',
    template: `1. Alprazolam 0.25mg - 1 tableta cada 8 horas
2. Ejercicios de respiración
3. Terapia psicológica semanal
4. Evitar cafeína y alcohol
5. Mantener rutina de sueño`,
    category: 'Psiquiatría'
  },
  {
    id: 8,
    name: 'Depresión',
    template: `1. Sertralina 50mg - 1 tableta diaria
2. Terapia psicológica semanal
3. Ejercicio físico regular
4. Mantener rutina de sueño
5. Control de efectos secundarios`,
    category: 'Psiquiatría'
  },
  // Gastroenterología
  {
    id: 9,
    name: 'Gastritis',
    template: `1. Omeprazol 20mg - 1 tableta diaria
2. Ranitidina 150mg - 1 tableta cada 12 horas
3. Dieta blanda
4. Evitar irritantes gástricos
5. Control de síntomas`,
    category: 'Gastroenterología'
  },
  {
    id: 10,
    name: 'Síndrome de Intestino Irritable',
    template: `1. Mebeverina 135mg - 1 tableta cada 8 horas
2. Probióticos diarios
3. Dieta FODMAP
4. Control de estrés
5. Ejercicio regular`,
    category: 'Gastroenterología'
  }
];

// Diagnósticos comunes con sus códigos ICD-10
export const commonDiagnoses = [
  // Cardiología
  {
    code: 'I10',
    name: 'Hipertensión arterial esencial (primaria)',
    category: 'Cardiología'
  },
  {
    code: 'I50',
    name: 'Insuficiencia cardíaca',
    category: 'Cardiología'
  },
  {
    code: 'I20',
    name: 'Angina de pecho',
    category: 'Cardiología'
  },
  // Endocrinología
  {
    code: 'E11',
    name: 'Diabetes mellitus tipo 2',
    category: 'Endocrinología'
  },
  {
    code: 'E03',
    name: 'Hipotiroidismo',
    category: 'Endocrinología'
  },
  {
    code: 'E78',
    name: 'Trastornos del metabolismo de las lipoproteínas',
    category: 'Endocrinología'
  },
  // Neumología
  {
    code: 'J06.9',
    name: 'Infección aguda de las vías respiratorias superiores',
    category: 'Neumología'
  },
  {
    code: 'J45',
    name: 'Asma',
    category: 'Neumología'
  },
  {
    code: 'J44',
    name: 'Otra enfermedad pulmonar obstructiva crónica',
    category: 'Neumología'
  },
  // Psiquiatría
  {
    code: 'F41.1',
    name: 'Trastorno de ansiedad generalizada',
    category: 'Psiquiatría'
  },
  {
    code: 'F32',
    name: 'Episodio depresivo',
    category: 'Psiquiatría'
  },
  {
    code: 'F43.2',
    name: 'Trastorno de adaptación',
    category: 'Psiquiatría'
  },
  // Gastroenterología
  {
    code: 'K29',
    name: 'Gastritis y duodenitis',
    category: 'Gastroenterología'
  },
  {
    code: 'K58',
    name: 'Síndrome del intestino irritable',
    category: 'Gastroenterología'
  },
  {
    code: 'K21',
    name: 'Enfermedad por reflujo gastroesofágico',
    category: 'Gastroenterología'
  },
  // Reumatología
  {
    code: 'M17',
    name: 'Gonartrosis (artrosis de rodilla)',
    category: 'Reumatología'
  },
  {
    code: 'M06',
    name: 'Artritis reumatoide',
    category: 'Reumatología'
  },
  {
    code: 'M54',
    name: 'Dorsalgia',
    category: 'Reumatología'
  }
];

// Categorías de especialidades médicas
export const medicalSpecialties = [
  'Cardiología',
  'Endocrinología',
  'Gastroenterología',
  'Neumología',
  'Neurología',
  'Oftalmología',
  'Ortopedia',
  'Pediatría',
  'Psiquiatría',
  'Reumatología'
];

// Función para filtrar diagnósticos por búsqueda con caché
export const filterDiagnoses = (searchTerm) => {
  const term = searchTerm.toLowerCase();
  const cacheKey = `diagnosis_${term}`;
  
  // Verificar caché
  const cachedResult = searchCache.get(cacheKey);
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_EXPIRY) {
    return cachedResult.data;
  }

  // Realizar búsqueda
  const results = commonDiagnoses.filter(diagnosis => 
    diagnosis.name.toLowerCase().includes(term) ||
    diagnosis.code.toLowerCase().includes(term) ||
    diagnosis.category.toLowerCase().includes(term)
  );

  // Guardar en caché
  searchCache.set(cacheKey, {
    data: results,
    timestamp: Date.now()
  });

  return results;
};

// Función para filtrar plantillas por categoría con caché
export const filterTemplatesByCategory = (category) => {
  const cacheKey = `templates_${category}`;
  
  // Verificar caché
  const cachedResult = searchCache.get(cacheKey);
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_EXPIRY) {
    return cachedResult.data;
  }

  // Realizar búsqueda
  const results = prescriptionTemplates.filter(template => 
    template.category === category
  );

  // Guardar en caché
  searchCache.set(cacheKey, {
    data: results,
    timestamp: Date.now()
  });

  return results;
};

// Función para limpiar la caché
export const clearSearchCache = () => {
  searchCache.clear();
};

// Función para obtener plantillas favoritas del localStorage
export const getFavoriteTemplates = () => {
  const favorites = localStorage.getItem('favoriteTemplates');
  return favorites ? JSON.parse(favorites) : [];
};

// Función para guardar plantilla como favorita
export const saveFavoriteTemplate = (templateId) => {
  const favorites = getFavoriteTemplates();
  if (!favorites.includes(templateId)) {
    favorites.push(templateId);
    localStorage.setItem('favoriteTemplates', JSON.stringify(favorites));
  }
};

// Función para remover plantilla de favoritos
export const removeFavoriteTemplate = (templateId) => {
  const favorites = getFavoriteTemplates();
  const updatedFavorites = favorites.filter(id => id !== templateId);
  localStorage.setItem('favoriteTemplates', JSON.stringify(updatedFavorites));
}; 