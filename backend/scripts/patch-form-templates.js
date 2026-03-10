// Temporary script to patch seed-form-templates-only.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'seed-form-templates-only.js');
let content = fs.readFileSync(filePath, 'utf8');

// Alergología - replace fields block
const alergologiaOld = `    fields: [
      { label: 'Alergeno principal', fieldType: 'TEXT', placeholder: 'Ej: Polen, polvo, alimentos', isRequired: true },
      { label: 'Tipo de reacción', fieldType: 'SELECT', options: ['Anafilaxia', 'Urticaria', 'Rinitis', 'Asma', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Pruebas realizadas', fieldType: 'TEXT', placeholder: 'Ej: Prick test, IgE', isRequired: false },
      { label: 'Evoluci\u00f3n cl\u00ednica', fieldType: 'TEXTAREA', placeholder: 'Describir evoluci\u00f3n', isRequired: false },
    ]
  },
  {
    name: 'Anestesiolog\u00eda',`;

const alergologiaNew = `    fields: [
      { label: 'Alergeno principal', fieldType: 'TEXT', placeholder: 'Ej: Polen, polvo, alimentos', isRequired: true },
      { label: 'Tipo de reacci\u00f3n', fieldType: 'SELECT', options: ['Anafilaxia', 'Urticaria', 'Rinitis', 'Asma', 'Dermatitis at\u00f3pica', 'Conjuntivitis al\u00e9rgica', 'Angioedema', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Severidad de reacci\u00f3n', fieldType: 'SELECT', options: ['Leve', 'Moderada', 'Severa', 'Anafilaxia'], placeholder: 'Seleccionar', isRequired: false },
      { label: 'V\u00eda de exposici\u00f3n', fieldType: 'SELECT', options: ['Inhalatoria', 'Alimentaria', 'Cut\u00e1nea', 'Medicamentosa', 'Veneno', 'Otro'], placeholder: 'Seleccionar', isRequired: false },
      { label: 'IgE total (kU/L)', fieldType: 'NUMBER', placeholder: 'kU/L', isRequired: false },
      { label: 'IgE espec\u00edfica', fieldType: 'TEXT', placeholder: 'Resultado IgE espec\u00edfica', isRequired: false },
      { label: 'Pruebas cut\u00e1neas (Prick test)', fieldType: 'TEXT', placeholder: 'Resultados prick test', isRequired: false },
      { label: 'Prueba de parche', fieldType: 'TEXT', placeholder: 'Resultados si aplica', isRequired: false },
      { label: 'Test de provocaci\u00f3n', fieldType: 'TEXT', placeholder: 'Resultado si realizado', isRequired: false },
      { label: 'Antecedentes familiares de atopia', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Rinitis al\u00e9rgica', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Asma bronquial', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Dermatitis at\u00f3pica', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Alergia a medicamentos', fieldType: 'TEXT', placeholder: 'Especificar medicamentos', isRequired: false },
      { label: 'Uso de antihistam\u00ednicos', fieldType: 'TEXT', placeholder: 'F\u00e1rmaco y dosis', isRequired: false },
      { label: 'Uso de corticoides', fieldType: 'TEXT', placeholder: 'V\u00eda y dosis si aplica', isRequired: false },
      { label: 'Inmunoterapia previa', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Epinefrina autoinyectable indicada', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Plan de evitaci\u00f3n', fieldType: 'TEXTAREA', placeholder: 'Medidas de evitaci\u00f3n', isRequired: false },
      { label: 'Evoluci\u00f3n cl\u00ednica', fieldType: 'TEXTAREA', placeholder: 'Describir evoluci\u00f3n', isRequired: false },
    ]
  },
  {
    name: 'Anestesiolog\u00eda',`;

if (content.includes("Pruebas realizadas")) {
  content = content.replace(alergologiaOld, alergologiaNew);
  fs.writeFileSync(filePath, content);
  console.log('Alergologia patched');
} else {
  console.log('Pattern not found - file may already be patched');
}
