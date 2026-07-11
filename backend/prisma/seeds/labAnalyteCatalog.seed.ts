import { PrismaClient } from '@prisma/client';

type CatalogRow = {
  category: string;
  name: string;
  aliases: string[];
  defaultUnit?: string;
  defaultReferenceLow?: number;
  defaultReferenceHigh?: number;
  sexSpecific?: boolean;
  allowedUnits?: string[];
  loincCode?: string;
};

const LAB_ANALYTE_CATALOG: CatalogRow[] = [
  { category: "Biometría hemática", name: "Hemoglobina", aliases: ["Hb","HGB","Hemoglobin"], defaultUnit: "g/dL", defaultReferenceLow: 12, defaultReferenceHigh: 16 },
  { category: "Biometría hemática", name: "Hematocrito", aliases: ["Hct","Hematocrit"], defaultUnit: "%", defaultReferenceLow: 36, defaultReferenceHigh: 48 },
  { category: "Biometría hemática", name: "Eritrocitos", aliases: ["RBC","Red blood cells","Glóbulos rojos"], defaultUnit: "mill/mm3", defaultReferenceLow: 4.2, defaultReferenceHigh: 5.4 },
  { category: "Biometría hemática", name: "Leucocitos", aliases: ["WBC","White blood cells","Glóbulos blancos"], defaultUnit: "/mm3", defaultReferenceLow: 4000, defaultReferenceHigh: 11000 },
  { category: "Biometría hemática", name: "Plaquetas", aliases: ["PLT","Platelets"], defaultUnit: "/mm3", defaultReferenceLow: 150000, defaultReferenceHigh: 450000, allowedUnits: ["/mm3", "10^3/μL", "K/μL"] },
  { category: "Biometría hemática", name: "Neutrófilos", aliases: ["Neutrophils","Segmentados"], defaultUnit: "%", defaultReferenceLow: 40, defaultReferenceHigh: 70 },
  { category: "Biometría hemática", name: "Linfocitos", aliases: ["Lymphocytes"], defaultUnit: "%", defaultReferenceLow: 20, defaultReferenceHigh: 45 },
  { category: "Biometría hemática", name: "Monocitos", aliases: ["Monocytes"], defaultUnit: "%", defaultReferenceLow: 2, defaultReferenceHigh: 10 },
  { category: "Biometría hemática", name: "Eosinófilos", aliases: ["Eosinophils"], defaultUnit: "%", defaultReferenceLow: 0, defaultReferenceHigh: 6 },
  { category: "Biometría hemática", name: "Basófilos", aliases: ["Basophils"], defaultUnit: "%", defaultReferenceLow: 0, defaultReferenceHigh: 2 },
  { category: "Biometría hemática", name: "VCM", aliases: ["MCV","Mean corpuscular volume"], defaultUnit: "fL", defaultReferenceLow: 80, defaultReferenceHigh: 100 },
  { category: "Biometría hemática", name: "HCM", aliases: ["MCH", "Hemoglobina corp. media", "Hemoglobina Corp. Media", "Hemoglobina Corpúsculo Media", "Hemoglobina corpuscular media"], defaultUnit: "pg", defaultReferenceLow: 27, defaultReferenceHigh: 33 },
  { category: "Biometría hemática", name: "CHCM", aliases: ["MCHC"], defaultUnit: "g/dL", defaultReferenceLow: 32, defaultReferenceHigh: 36 },
  { category: "Biometría hemática", name: "RDW", aliases: ["Red cell distribution width"], defaultUnit: "%", defaultReferenceLow: 11.5, defaultReferenceHigh: 14.5 },
  { category: "Química sanguínea", name: "Glucosa", aliases: ["Glucose","Glu"], defaultUnit: "mg/dL", defaultReferenceLow: 70, defaultReferenceHigh: 100 },
  { category: "Química sanguínea", name: "Urea", aliases: ["Urea nitrogen"], defaultUnit: "mg/dL", defaultReferenceLow: 15, defaultReferenceHigh: 45 },
  { category: "Química sanguínea", name: "Creatinina", aliases: ["Creatinine","Cr"], defaultUnit: "mg/dL", defaultReferenceLow: 0.6, defaultReferenceHigh: 1.2 },
  { category: "Química sanguínea", name: "Ácido úrico", aliases: ["Uric acid"], defaultUnit: "mg/dL", defaultReferenceLow: 3.5, defaultReferenceHigh: 7.2 },
  { category: "Química sanguínea", name: "BUN", aliases: ["Blood urea nitrogen","Nitrógeno ureico"], defaultUnit: "mg/dL", defaultReferenceLow: 7, defaultReferenceHigh: 20 },
  { category: "Química sanguínea", name: "Calcio", aliases: ["Calcium","Ca"], defaultUnit: "mg/dL", defaultReferenceLow: 8.5, defaultReferenceHigh: 10.5 },
  { category: "Química sanguínea", name: "Fósforo", aliases: ["Phosphorus","Phosphate"], defaultUnit: "mg/dL", defaultReferenceLow: 2.5, defaultReferenceHigh: 4.5 },
  { category: "Química sanguínea", name: "Proteínas totales", aliases: ["Total protein"], defaultUnit: "g/dL", defaultReferenceLow: 6, defaultReferenceHigh: 8.3 },
  { category: "Química sanguínea", name: "Albúmina", aliases: ["Albumin"], defaultUnit: "g/dL", defaultReferenceLow: 3.5, defaultReferenceHigh: 5.2 },
  { category: "Química sanguínea", name: "Globulina", aliases: ["Globulin", "Globulinas"], defaultUnit: "g/dL", defaultReferenceLow: 2, defaultReferenceHigh: 3.5 },
  { category: "Inmunología", name: "Inmunoglobulina A", aliases: ["IgA", "Immunoglobulin A"], defaultUnit: "mg/dL", defaultReferenceLow: 70, defaultReferenceHigh: 400 },
  { category: "Inmunología", name: "Inmunoglobulina G", aliases: ["IgG", "Immunoglobulin G"], defaultUnit: "mg/dL", defaultReferenceLow: 700, defaultReferenceHigh: 1600 },
  { category: "Inmunología", name: "Inmunoglobulina M", aliases: ["IgM", "Immunoglobulin M"], defaultUnit: "mg/dL", defaultReferenceLow: 40, defaultReferenceHigh: 230 },
  { category: "Perfil lipídico", name: "Colesterol total", aliases: ["Total cholesterol","CT","Colesterol","Colesterol (total)"], defaultUnit: "mg/dL", defaultReferenceHigh: 200, allowedUnits: ["mg/dL", "mmol/L"], loincCode: "2093-3" },
  { category: "Perfil lipídico", name: "HDL", aliases: ["HDL-C","Colesterol HDL"], defaultUnit: "mg/dL", defaultReferenceLow: 40 },
  { category: "Perfil lipídico", name: "LDL", aliases: ["LDL-C","Colesterol LDL"], defaultUnit: "mg/dL", defaultReferenceHigh: 100 },
  { category: "Perfil lipídico", name: "VLDL", aliases: ["VLDL-C","VLDL colesterol","Colesterol VLDL"], defaultUnit: "mg/dL", defaultReferenceLow: 5, defaultReferenceHigh: 40 },
  { category: "Perfil lipídico", name: "Colesterol no-HDL", aliases: ["Colesterol no HDL","Non-HDL cholesterol","no-HDL"], defaultUnit: "mg/dL", defaultReferenceHigh: 130 },
  { category: "Perfil lipídico", name: "Triglicéridos", aliases: ["Triglycerides","TG"], defaultUnit: "mg/dL", defaultReferenceHigh: 150 },
  { category: "Perfil lipídico", name: "Índice aterogénico", aliases: ["Atherogenic index","CT/HDL"] },
  { category: "Perfil hepático", name: "ALT/TGP", aliases: ["ALT","GPT","Alanina aminotransferasa","TGP","SGPT"], defaultUnit: "U/L", defaultReferenceHigh: 40, allowedUnits: ["U/L", "UI/L"] },
  { category: "Perfil hepático", name: "AST/TGO", aliases: ["AST","GOT","Aspartato aminotransferasa","TGO","SGOT"], defaultUnit: "U/L", defaultReferenceHigh: 40, allowedUnits: ["U/L", "UI/L"] },
  { category: "Perfil hepático", name: "GGT", aliases: ["Gamma glutamil transferasa","Gamma-GT"], defaultUnit: "U/L", defaultReferenceHigh: 55 },
  { category: "Perfil hepático", name: "Fosfatasa alcalina", aliases: ["ALP","Alkaline phosphatase"], defaultUnit: "U/L", defaultReferenceLow: 44, defaultReferenceHigh: 147 },
  { category: "Perfil hepático", name: "Bilirrubina total", aliases: ["Total bilirubin"], defaultUnit: "mg/dL", defaultReferenceLow: 0.1, defaultReferenceHigh: 1.2 },
  { category: "Perfil hepático", name: "Bilirrubina directa", aliases: ["Direct bilirubin","Conjugated bilirubin"], defaultUnit: "mg/dL", defaultReferenceHigh: 0.3 },
  { category: "Perfil hepático", name: "Bilirrubina indirecta", aliases: ["Indirect bilirubin","Unconjugated bilirubin"], defaultUnit: "mg/dL", defaultReferenceLow: 0.1, defaultReferenceHigh: 0.8 },
  { category: "Perfil hepático", name: "Albúmina", aliases: ["Albumin"], defaultUnit: "g/dL", defaultReferenceLow: 3.5, defaultReferenceHigh: 5.2 },
  { category: "Perfil hepático", name: "Proteínas totales", aliases: ["Total protein"], defaultUnit: "g/dL", defaultReferenceLow: 6, defaultReferenceHigh: 8.3 },
  { category: "Función renal", name: "Creatinina", aliases: ["Creatinine","Cr"], defaultUnit: "mg/dL", defaultReferenceLow: 0.6, defaultReferenceHigh: 1.2 },
  { category: "Función renal", name: "Urea", aliases: ["Urea"], defaultUnit: "mg/dL", defaultReferenceLow: 15, defaultReferenceHigh: 45 },
  { category: "Función renal", name: "BUN", aliases: ["Blood urea nitrogen"], defaultUnit: "mg/dL", defaultReferenceLow: 7, defaultReferenceHigh: 20 },
  { category: "Función renal", name: "eGFR", aliases: ["GFR","Filtrado glomerular estimado"], defaultUnit: "mL/min/1.73m2", defaultReferenceLow: 90 },
  { category: "Función renal", name: "Microalbuminuria", aliases: ["Microalbumin","Albuminuria"], defaultUnit: "mg/L", defaultReferenceHigh: 30 },
  { category: "Función renal", name: "Relación albúmina/creatinina", aliases: ["ACR","Albumin/creatinine ratio"], defaultUnit: "mg/g", defaultReferenceHigh: 30 },
  { category: "Diabetes", name: "Glucosa ayuno", aliases: ["Fasting glucose","Glucosa en ayunas"], defaultUnit: "mg/dL", defaultReferenceLow: 70, defaultReferenceHigh: 100 },
  { category: "Diabetes", name: "HbA1c", aliases: ["A1c","Hemoglobin A1c","Hemoglobina glicosilada","Hemoglobina glicosilada A1c","Hb A1c"], defaultUnit: "%", defaultReferenceHigh: 5.7, loincCode: "4548-4" },
  { category: "Diabetes", name: "Insulina", aliases: ["Insulin","Insulinemia","Insulina basal"], defaultUnit: "µU/mL", defaultReferenceLow: 2, defaultReferenceHigh: 25, allowedUnits: ["µU/mL", "μUI/mL", "uUI/mL", "mUI/L"] },
  { category: "Diabetes", name: "HOMA-IR", aliases: ["HOMA IR","Índice HOMA"], defaultReferenceHigh: 2.5 },
  { category: "Diabetes", name: "Curva tolerancia glucosa", aliases: ["OGTT","Glucose tolerance test","PTOG"], defaultUnit: "mg/dL" },
  { category: "Orina", name: "Color", aliases: ["Colour"] },
  { category: "Orina", name: "Aspecto", aliases: ["Appearance"] },
  { category: "Orina", name: "Densidad", aliases: ["Specific gravity","Gravedad específica"], defaultReferenceLow: 1.005, defaultReferenceHigh: 1.03 },
  { category: "Orina", name: "pH", aliases: ["pH urinario"], defaultReferenceLow: 4.5, defaultReferenceHigh: 8 },
  { category: "Orina", name: "Proteínas", aliases: ["Protein","Proteinuria"] },
  { category: "Orina", name: "Glucosa", aliases: ["Glucose","Glucosuria"] },
  { category: "Orina", name: "Cetonas", aliases: ["Ketones","Cetonuria"] },
  { category: "Orina", name: "Bilirrubina", aliases: ["Bilirubin"] },
  { category: "Orina", name: "Urobilinógeno", aliases: ["Urobilinogen"] },
  { category: "Orina", name: "Nitritos", aliases: ["Nitrites"] },
  { category: "Orina", name: "Leucocitos", aliases: ["Leukocytes","WBC urine"] },
  { category: "Orina", name: "Eritrocitos", aliases: ["Erythrocytes","RBC urine"] },
  { category: "Orina", name: "Hemoglobina", aliases: ["Blood","Hemoglobin urine"] },
  { category: "Orina", name: "Bacterias", aliases: ["Bacteria"] },
  { category: "Orina", name: "Cristales", aliases: ["Crystals"] },
  { category: "Orina", name: "Cilindros", aliases: ["Casts"] },
  { category: "Orina", name: "Células epiteliales", aliases: ["Epithelial cells"] },
  { category: "Tiroides", name: "TSH", aliases: ["Thyroid stimulating hormone"], defaultUnit: "µUI/mL", defaultReferenceLow: 0.4, defaultReferenceHigh: 4 },
  { category: "Tiroides", name: "T3 total", aliases: ["Total T3","Triyodotironina total"], defaultUnit: "ng/dL", defaultReferenceLow: 80, defaultReferenceHigh: 200 },
  { category: "Tiroides", name: "T3 libre", aliases: ["Free T3","FT3"], defaultUnit: "pg/mL", defaultReferenceLow: 2.3, defaultReferenceHigh: 4.2 },
  { category: "Tiroides", name: "T4 total", aliases: ["Total T4","Tiroxina total"], defaultUnit: "µg/dL", defaultReferenceLow: 5, defaultReferenceHigh: 12 },
  { category: "Tiroides", name: "T4 libre", aliases: ["Free T4","FT4"], defaultUnit: "ng/dL", defaultReferenceLow: 0.8, defaultReferenceHigh: 1.8 },
  { category: "Tiroides", name: "Anti-TPO", aliases: ["TPO antibodies","Anticuerpos anti-TPO"], defaultUnit: "IU/mL" },
  { category: "Tiroides", name: "Anti-tiroglobulina", aliases: ["Anti-thyroglobulin","ATG"], defaultUnit: "IU/mL" },
  { category: "Electrolitos", name: "Sodio", aliases: ["Na","Sodium"], defaultUnit: "mEq/L", defaultReferenceLow: 135, defaultReferenceHigh: 145 },
  { category: "Electrolitos", name: "Potasio", aliases: ["K","Potassium"], defaultUnit: "mEq/L", defaultReferenceLow: 3.5, defaultReferenceHigh: 5.1 },
  { category: "Electrolitos", name: "Cloro", aliases: ["Cl","Chloride"], defaultUnit: "mEq/L", defaultReferenceLow: 98, defaultReferenceHigh: 107 },
  { category: "Electrolitos", name: "Magnesio", aliases: ["Mg","Magnesium"], defaultUnit: "mg/dL", defaultReferenceLow: 1.7, defaultReferenceHigh: 2.2 },
  { category: "Electrolitos", name: "Calcio", aliases: ["Ca","Calcium"], defaultUnit: "mg/dL", defaultReferenceLow: 8.5, defaultReferenceHigh: 10.5 },
  { category: "Electrolitos", name: "Fósforo", aliases: ["Phosphorus","Phosphate"], defaultUnit: "mg/dL", defaultReferenceLow: 2.5, defaultReferenceHigh: 4.5 },
  { category: "Vitaminas", name: "Vitamina D", aliases: ["25-OH vitamin D","Vit D","25-hidroxivitamina D"], defaultUnit: "ng/mL", defaultReferenceLow: 30, defaultReferenceHigh: 100 },
  { category: "Vitaminas", name: "B12", aliases: ["Vitamin B12","Cobalamina"], defaultUnit: "pg/mL", defaultReferenceLow: 200, defaultReferenceHigh: 900 },
  { category: "Vitaminas", name: "Ácido fólico", aliases: ["Folic acid","Folate"], defaultUnit: "ng/mL", defaultReferenceLow: 3, defaultReferenceHigh: 17 },
  { category: "Vitaminas", name: "Ferritina", aliases: ["Ferritin"], defaultUnit: "ng/mL", defaultReferenceLow: 15, defaultReferenceHigh: 200 },
  { category: "Vitaminas", name: "Hierro sérico", aliases: ["Serum iron","Fe"], defaultUnit: "µg/dL", defaultReferenceLow: 60, defaultReferenceHigh: 170 },
  { category: "Vitaminas", name: "Transferrina", aliases: ["Transferrin"], defaultUnit: "mg/dL", defaultReferenceLow: 200, defaultReferenceHigh: 360 },
  { category: "Vitaminas", name: "Saturación transferrina", aliases: ["Transferrin saturation","TSAT"], defaultUnit: "%", defaultReferenceLow: 20, defaultReferenceHigh: 50 },
  { category: "Inflamación", name: "PCR", aliases: ["CRP","C-reactive protein","Proteína C reactiva"], defaultUnit: "mg/L", defaultReferenceHigh: 5 },
  { category: "Inflamación", name: "VSG", aliases: ["ESR","Sed rate","Velocidad de sedimentación"], defaultUnit: "mm/h", defaultReferenceHigh: 20 },
  { category: "Inflamación", name: "Ferritina", aliases: ["Ferritin"], defaultUnit: "ng/mL", defaultReferenceLow: 15, defaultReferenceHigh: 200 },
  { category: "Inflamación", name: "Procalcitonina", aliases: ["PCT","Procalcitonin"], defaultUnit: "ng/mL", defaultReferenceHigh: 0.1 },
  { category: "Coagulación", name: "TP", aliases: ["Prothrombin time","PT","Tiempo de protrombina"], defaultUnit: "seg", defaultReferenceLow: 11, defaultReferenceHigh: 13.5 },
  { category: "Coagulación", name: "INR", aliases: ["International normalized ratio"], defaultReferenceLow: 0.9, defaultReferenceHigh: 1.1 },
  { category: "Coagulación", name: "TTPa", aliases: ["aPTT","PTT","Tiempo de tromboplastina parcial"], defaultUnit: "seg", defaultReferenceLow: 25, defaultReferenceHigh: 35 },
  { category: "Coagulación", name: "Fibrinógeno", aliases: ["Fibrinogen"], defaultUnit: "mg/dL", defaultReferenceLow: 200, defaultReferenceHigh: 400 },
  { category: "Coagulación", name: "Dímero D", aliases: ["D-dimer","D dimer"], defaultUnit: "µg/mL", defaultReferenceHigh: 0.5 },
  { category: "Hormonas", name: "Cortisol", aliases: ["Cortisol AM","Hydrocortisone"], defaultUnit: "µg/dL", defaultReferenceLow: 5, defaultReferenceHigh: 25 },
  { category: "Hormonas", name: "Testosterona total", aliases: ["Total testosterone"], defaultUnit: "ng/dL", sexSpecific: true },
  { category: "Hormonas", name: "Testosterona libre", aliases: ["Free testosterone"], defaultUnit: "pg/mL", sexSpecific: true },
  { category: "Hormonas", name: "Estradiol", aliases: ["E2","Estrogen"], defaultUnit: "pg/mL", sexSpecific: true },
  { category: "Hormonas", name: "Progesterona", aliases: ["Progesterone"], defaultUnit: "ng/mL" },
  { category: "Hormonas", name: "Prolactina", aliases: ["PRL","Prolactin"], defaultUnit: "ng/mL", defaultReferenceLow: 2, defaultReferenceHigh: 18 },
  { category: "Hormonas", name: "LH", aliases: ["Luteinizing hormone","Hormona luteinizante"], defaultUnit: "mUI/mL" },
  { category: "Hormonas", name: "FSH", aliases: ["Follicle stimulating hormone","Hormona folículo estimulante"], defaultUnit: "mUI/mL" },
];

export async function seedLabAnalyteCatalog(prisma: PrismaClient): Promise<void> {
  console.log('Seeding lab analyte catalog...');
  for (const row of LAB_ANALYTE_CATALOG) {
    const existing = await prisma.labAnalyteCatalog.findFirst({
      where: { category: row.category, name: row.name },
    });
    const data = {
      category: row.category,
      name: row.name,
      aliasesJson: row.aliases,
      loincCode: row.loincCode ?? null,
      allowedUnitsJson: row.allowedUnits ?? [],
      defaultUnit: row.defaultUnit ?? null,
      defaultReferenceLow: row.defaultReferenceLow ?? null,
      defaultReferenceHigh: row.defaultReferenceHigh ?? null,
      sexSpecific: row.sexSpecific ?? false,
      ageSpecific: false,
      active: true,
    };
    if (existing) {
      await prisma.labAnalyteCatalog.update({ where: { id: existing.id }, data });
    } else {
      await prisma.labAnalyteCatalog.create({ data });
    }
  }
  console.log(`Lab analyte catalog: ${LAB_ANALYTE_CATALOG.length} entries upserted.`);
}
