'use strict';
const fs = require('fs');
const path = require('path');
const outPath = path.join(__dirname, '..', 'prisma', 'seeds', 'labAnalyteCatalog.seed.ts');

const CAT = {
  'Biometr\u00eda hem\u00e1tica': [
    ['Hemoglobina', 'g/dL', 12, 16, ['Hb', 'HGB', 'Hemoglobin']],
    ['Hematocrito', '%', 36, 48, ['Hct', 'Hematocrit']],
    ['Eritrocitos', 'mill/mm3', 4.2, 5.4, ['RBC', 'Red blood cells', 'Gl\u00f3bulos rojos']],
    ['Leucocitos', '/mm3', 4000, 11000, ['WBC', 'White blood cells', 'Gl\u00f3bulos blancos']],
    ['Plaquetas', '/mm3', 150000, 450000, ['PLT', 'Platelets']],
    ['Neutr\u00f3filos', '%', 40, 70, ['Neutrophils', 'Segmentados']],
    ['Linfocitos', '%', 20, 45, ['Lymphocytes']],
    ['Monocitos', '%', 2, 10, ['Monocytes']],
    ['Eosin\u00f3filos', '%', 0, 6, ['Eosinophils']],
    ['Bas\u00f3filos', '%', 0, 2, ['Basophils']],
    ['VCM', 'fL', 80, 100, ['MCV', 'Mean corpuscular volume']],
    ['HCM', 'pg', 27, 33, ['MCH']],
    ['CHCM', 'g/dL', 32, 36, ['MCHC']],
    ['RDW', '%', 11.5, 14.5, ['Red cell distribution width']],
  ],
  'Qu\u00edmica sangu\u00ednea': [
    ['Glucosa', 'mg/dL', 70, 100, ['Glucose', 'Glu']],
    ['Urea', 'mg/dL', 15, 45, ['Urea nitrogen']],
    ['Creatinina', 'mg/dL', 0.6, 1.2, ['Creatinine', 'Cr']],
    ['\u00c1cido \u00farico', 'mg/dL', 3.5, 7.2, ['Uric acid']],
    ['BUN', 'mg/dL', 7, 20, ['Blood urea nitrogen', 'Nitr\u00f3geno ureico']],
    ['Calcio', 'mg/dL', 8.5, 10.5, ['Calcium', 'Ca']],
    ['F\u00f3sforo', 'mg/dL', 2.5, 4.5, ['Phosphorus', 'Phosphate']],
    ['Prote\u00ednas totales', 'g/dL', 6, 8.3, ['Total protein']],
    ['Alb\u00famina', 'g/dL', 3.5, 5.2, ['Albumin']],
    ['Globulina', 'g/dL', 2, 3.5, ['Globulin']],
  ],
  'Perfil lip\u00eddico': [
    ['Colesterol total', 'mg/dL', null, 200, ['Total cholesterol', 'CT']],
    ['HDL', 'mg/dL', 40, null, ['HDL-C', 'Colesterol HDL']],
    ['LDL', 'mg/dL', null, 100, ['LDL-C', 'Colesterol LDL']],
    ['VLDL', 'mg/dL', 5, 40, ['VLDL-C']],
    ['Triglic\u00e9ridos', 'mg/dL', null, 150, ['Triglycerides', 'TG']],
    ['\u00cdndice aterog\u00e9nico', null, null, null, ['Atherogenic index', 'CT/HDL']],
  ],
  'Perfil hep\u00e1tico': [
    ['ALT/TGP', 'U/L', null, 40, ['ALT', 'GPT', 'Alanina aminotransferasa']],
    ['AST/TGO', 'U/L', null, 40, ['AST', 'GOT', 'Aspartato aminotransferasa']],
    ['GGT', 'U/L', null, 55, ['Gamma glutamil transferasa', 'Gamma-GT']],
    ['Fosfatasa alcalina', 'U/L', 44, 147, ['ALP', 'Alkaline phosphatase']],
    ['Bilirrubina total', 'mg/dL', 0.1, 1.2, ['Total bilirubin']],
    ['Bilirrubina directa', 'mg/dL', null, 0.3, ['Direct bilirubin', 'Conjugated bilirubin']],
    ['Bilirrubina indirecta', 'mg/dL', 0.1, 0.8, ['Indirect bilirubin', 'Unconjugated bilirubin']],
    ['Alb\u00famina', 'g/dL', 3.5, 5.2, ['Albumin']],
    ['Prote\u00ednas totales', 'g/dL', 6, 8.3, ['Total protein']],
  ],
  'Funci\u00f3n renal': [
    ['Creatinina', 'mg/dL', 0.6, 1.2, ['Creatinine', 'Cr']],
    ['Urea', 'mg/dL', 15, 45, ['Urea']],
    ['BUN', 'mg/dL', 7, 20, ['Blood urea nitrogen']],
    ['eGFR', 'mL/min/1.73m2', 90, null, ['GFR', 'Filtrado glomerular estimado']],
    ['Microalbuminuria', 'mg/L', null, 30, ['Microalbumin', 'Albuminuria']],
    ['Relaci\u00f3n alb\u00famina/creatinina', 'mg/g', null, 30, ['ACR', 'Albumin/creatinine ratio']],
  ],
  'Diabetes': [
    ['Glucosa ayuno', 'mg/dL', 70, 100, ['Fasting glucose', 'Glucosa en ayunas']],
    ['HbA1c', '%', null, 5.7, ['A1c', 'Hemoglobin A1c', 'Hemoglobina glicosilada']],
    ['Insulina', '\u00b5U/mL', 2, 25, ['Insulin', 'Insulinemia']],
    ['HOMA-IR', null, null, 2.5, ['HOMA IR', '\u00cdndice HOMA']],
    ['Curva tolerancia glucosa', 'mg/dL', null, null, ['OGTT', 'Glucose tolerance test', 'PTOG']],
  ],
  'Orina': [
    ['Color', null, null, null, ['Colour']],
    ['Aspecto', null, null, null, ['Appearance']],
    ['Densidad', null, 1.005, 1.03, ['Specific gravity', 'Gravedad espec\u00edfica']],
    ['pH', null, 4.5, 8, ['pH urinario']],
    ['Prote\u00ednas', null, null, null, ['Protein', 'Proteinuria']],
    ['Glucosa', null, null, null, ['Glucose', 'Glucosuria']],
    ['Cetonas', null, null, null, ['Ketones', 'Cetonuria']],
    ['Bilirrubina', null, null, null, ['Bilirubin']],
    ['Urobilin\u00f3geno', null, null, null, ['Urobilinogen']],
    ['Nitritos', null, null, null, ['Nitrites']],
    ['Leucocitos', null, null, null, ['Leukocytes', 'WBC urine']],
    ['Eritrocitos', null, null, null, ['Erythrocytes', 'RBC urine']],
    ['Hemoglobina', null, null, null, ['Blood', 'Hemoglobin urine']],
    ['Bacterias', null, null, null, ['Bacteria']],
    ['Cristales', null, null, null, ['Crystals']],
    ['Cilindros', null, null, null, ['Casts']],
    ['C\u00e9lulas epiteliales', null, null, null, ['Epithelial cells']],
  ],
  'Tiroides': [
    ['TSH', '\u00b5UI/mL', 0.4, 4, ['Thyroid stimulating hormone']],
    ['T3 total', 'ng/dL', 80, 200, ['Total T3', 'Triyodotironina total']],
    ['T3 libre', 'pg/mL', 2.3, 4.2, ['Free T3', 'FT3']],
    ['T4 total', '\u00b5g/dL', 5, 12, ['Total T4', 'Tiroxina total']],
    ['T4 libre', 'ng/dL', 0.8, 1.8, ['Free T4', 'FT4']],
    ['Anti-TPO', 'IU/mL', null, null, ['TPO antibodies', 'Anticuerpos anti-TPO']],
    ['Anti-tiroglobulina', 'IU/mL', null, null, ['Anti-thyroglobulin', 'ATG']],
  ],
  'Electrolitos': [
    ['Sodio', 'mEq/L', 135, 145, ['Na', 'Sodium']],
    ['Potasio', 'mEq/L', 3.5, 5.1, ['K', 'Potassium']],
    ['Cloro', 'mEq/L', 98, 107, ['Cl', 'Chloride']],
    ['Magnesio', 'mg/dL', 1.7, 2.2, ['Mg', 'Magnesium']],
    ['Calcio', 'mg/dL', 8.5, 10.5, ['Ca', 'Calcium']],
    ['F\u00f3sforo', 'mg/dL', 2.5, 4.5, ['Phosphorus', 'Phosphate']],
  ],
  'Vitaminas': [
    ['Vitamina D', 'ng/mL', 30, 100, ['25-OH vitamin D', 'Vit D', '25-hidroxivitamina D']],
    ['B12', 'pg/mL', 200, 900, ['Vitamin B12', 'Cobalamina']],
    ['\u00c1cido f\u00f3lico', 'ng/mL', 3, 17, ['Folic acid', 'Folate']],
    ['Ferritina', 'ng/mL', 15, 200, ['Ferritin']],
    ['Hierro s\u00e9rico', '\u00b5g/dL', 60, 170, ['Serum iron', 'Fe']],
    ['Transferrina', 'mg/dL', 200, 360, ['Transferrin']],
    ['Saturaci\u00f3n transferrina', '%', 20, 50, ['Transferrin saturation', 'TSAT']],
  ],
  'Inflamaci\u00f3n': [
    ['PCR', 'mg/L', null, 5, ['CRP', 'C-reactive protein', 'Prote\u00edna C reactiva']],
    ['VSG', 'mm/h', null, 20, ['ESR', 'Sed rate', 'Velocidad de sedimentaci\u00f3n']],
    ['Ferritina', 'ng/mL', 15, 200, ['Ferritin']],
    ['Procalcitonina', 'ng/mL', null, 0.1, ['PCT', 'Procalcitonin']],
  ],
  'Coagulaci\u00f3n': [
    ['TP', 'seg', 11, 13.5, ['Prothrombin time', 'PT', 'Tiempo de protrombina']],
    ['INR', null, 0.9, 1.1, ['International normalized ratio']],
    ['TTPa', 'seg', 25, 35, ['aPTT', 'PTT', 'Tiempo de tromboplastina parcial']],
    ['Fibrin\u00f3geno', 'mg/dL', 200, 400, ['Fibrinogen']],
    ['D\u00edmero D', '\u00b5g/mL', null, 0.5, ['D-dimer', 'D dimer']],
  ],
  'Hormonas': [
    ['Cortisol', '\u00b5g/dL', 5, 25, ['Cortisol AM', 'Hydrocortisone']],
    ['Testosterona total', 'ng/dL', null, null, ['Total testosterone'], true],
    ['Testosterona libre', 'pg/mL', null, null, ['Free testosterone'], true],
    ['Estradiol', 'pg/mL', null, null, ['E2', 'Estrogen'], true],
    ['Progesterona', 'ng/mL', null, null, ['Progesterone']],
    ['Prolactina', 'ng/mL', 2, 18, ['PRL', 'Prolactin']],
    ['LH', 'mUI/mL', null, null, ['Luteinizing hormone', 'Hormona luteinizante']],
    ['FSH', 'mUI/mL', null, null, ['Follicle stimulating hormone', 'Hormona fol\u00edculo estimulante']],
  ],
};

const rows = [];
for (const [category, items] of Object.entries(CAT)) {
  for (const item of items) {
    const [name, unit, low, high, aliases, sexSpecific] = item;
    rows.push({ category, name, unit, low, high, aliases, sexSpecific: !!sexSpecific });
  }
}

const lines = [];
lines.push("import { PrismaClient } from '@prisma/client';");
lines.push('');
lines.push('type CatalogRow = {');
lines.push('  category: string;');
lines.push('  name: string;');
lines.push('  aliases: string[];');
lines.push('  defaultUnit?: string;');
lines.push('  defaultReferenceLow?: number;');
lines.push('  defaultReferenceHigh?: number;');
lines.push('  sexSpecific?: boolean;');
lines.push('};');
lines.push('');
lines.push('const LAB_ANALYTE_CATALOG: CatalogRow[] = [');
for (const r of rows) {
  const parts = [
    '  { category: ' + JSON.stringify(r.category) + ', name: ' + JSON.stringify(r.name) + ', aliases: ' + JSON.stringify(r.aliases),
  ];
  if (r.unit) parts.push('defaultUnit: ' + JSON.stringify(r.unit));
  if (r.low != null) parts.push('defaultReferenceLow: ' + r.low);
  if (r.high != null) parts.push('defaultReferenceHigh: ' + r.high);
  if (r.sexSpecific) parts.push('sexSpecific: true');
  lines.push(parts.join(', ') + ' },');
}
lines.push('];');
lines.push('');
lines.push('export async function seedLabAnalyteCatalog(prisma: PrismaClient): Promise<void> {');
lines.push("  console.log('Seeding lab analyte catalog...');");
lines.push('  for (const row of LAB_ANALYTE_CATALOG) {');
lines.push('    const existing = await prisma.labAnalyteCatalog.findFirst({');
lines.push('      where: { category: row.category, name: row.name },');
lines.push('    });');
lines.push('    const data = {');
lines.push('      category: row.category,');
lines.push('      name: row.name,');
lines.push('      aliasesJson: row.aliases,');
lines.push('      defaultUnit: row.defaultUnit ?? null,');
lines.push('      defaultReferenceLow: row.defaultReferenceLow ?? null,');
lines.push('      defaultReferenceHigh: row.defaultReferenceHigh ?? null,');
lines.push('      sexSpecific: row.sexSpecific ?? false,');
lines.push('      ageSpecific: false,');
lines.push('      active: true,');
lines.push('    };');
lines.push('    if (existing) {');
lines.push('      await prisma.labAnalyteCatalog.update({ where: { id: existing.id }, data });');
lines.push('    } else {');
lines.push('      await prisma.labAnalyteCatalog.create({ data });');
lines.push('    }');
lines.push('  }');
lines.push('  console.log(`Lab analyte catalog: ${LAB_ANALYTE_CATALOG.length} entries upserted.`);');
lines.push('}');
lines.push('');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote', rows.length, 'entries,', Object.keys(CAT).length, 'categories');
