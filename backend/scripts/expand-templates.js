// Script to expand form templates - run with: node expand-templates.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'seed-form-templates-only.js');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  // Alergología
  {
    old: `    fields: [
      { label: 'Alergeno principal', fieldType: 'TEXT', placeholder: 'Ej: Polen, polvo, alimentos', isRequired: true },
      { label: 'Tipo de reacción', fieldType: 'SELECT', options: ['Anafilaxia', 'Urticaria', 'Rinitis', 'Asma', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Pruebas realizadas', fieldType: 'TEXT', placeholder: 'Ej: Prick test, IgE', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Anestesiología',`,
    new: `    fields: [
      { label: 'Alergeno principal', fieldType: 'TEXT', placeholder: 'Ej: Polen, polvo, alimentos', isRequired: true },
      { label: 'Tipo de reacción', fieldType: 'SELECT', options: ['Anafilaxia', 'Urticaria', 'Rinitis', 'Asma', 'Dermatitis atópica', 'Conjuntivitis alérgica', 'Angioedema', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Severidad de reacción', fieldType: 'SELECT', options: ['Leve', 'Moderada', 'Severa', 'Anafilaxia'], placeholder: 'Seleccionar', isRequired: false },
      { label: 'Vía de exposición', fieldType: 'SELECT', options: ['Inhalatoria', 'Alimentaria', 'Cutánea', 'Medicamentosa', 'Veneno', 'Otro'], placeholder: 'Seleccionar', isRequired: false },
      { label: 'IgE total (kU/L)', fieldType: 'NUMBER', placeholder: 'kU/L', isRequired: false },
      { label: 'IgE específica', fieldType: 'TEXT', placeholder: 'Resultado IgE específica', isRequired: false },
      { label: 'Pruebas cutáneas (Prick test)', fieldType: 'TEXT', placeholder: 'Resultados prick test', isRequired: false },
      { label: 'Prueba de parche', fieldType: 'TEXT', placeholder: 'Resultados si aplica', isRequired: false },
      { label: 'Test de provocación', fieldType: 'TEXT', placeholder: 'Resultado si realizado', isRequired: false },
      { label: 'Antecedentes familiares de atopia', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Rinitis alérgica', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Asma bronquial', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Dermatitis atópica', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Alergia a medicamentos', fieldType: 'TEXT', placeholder: 'Especificar medicamentos', isRequired: false },
      { label: 'Uso de antihistamínicos', fieldType: 'TEXT', placeholder: 'Fármaco y dosis', isRequired: false },
      { label: 'Uso de corticoides', fieldType: 'TEXT', placeholder: 'Vía y dosis si aplica', isRequired: false },
      { label: 'Inmunoterapia previa', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Epinefrina autoinyectable indicada', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Plan de evitación', fieldType: 'TEXTAREA', placeholder: 'Medidas de evitación', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Anestesiología',`
  }
];

let count = 0;
for (const r of replacements) {
  if (content.includes(r.old.substring(0, 50))) {
    content = content.replace(r.old, r.new);
    count++;
    console.log('Applied replacement');
  }
}

fs.writeFileSync(filePath, content);
console.log('Done. Applied', count, 'replacements');
