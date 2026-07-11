import fs from 'fs';
import path from 'path';
import { validateLabPdfBuffer } from '../src/services/smartLab/labPdfValidation.service';
import { parseLabResultsFromText } from '../src/services/smartLab/labParser.service';
import { normalizeParsedResults } from '../src/services/smartLab/labNormalization.service';

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Uso: npx ts-node scripts/test-smart-lab-upload.ts <ruta-al-pdf>');
    process.exit(1);
  }

  const abs = path.resolve(fileArg);
  if (!fs.existsSync(abs)) {
    console.error('Archivo no encontrado:', abs);
    process.exit(1);
  }

  const buffer = fs.readFileSync(abs);
  console.log('Archivo:', abs, 'bytes:', buffer.length);

  const { text } = await validateLabPdfBuffer(buffer, 'application/pdf');
  console.log('Texto extraido (primeros 200 chars):', text.slice(0, 200));

  const parsed = parseLabResultsFromText(text);
  console.log('Lineas parseadas:', parsed.length);
  parsed.slice(0, 10).forEach((row, i) => {
    console.log(`  [${i}]`, row.analyteNameRaw, row.resultValue, row.resultUnit, row.referenceRangeText);
  });

  try {
    const normalized = await normalizeParsedResults(parsed);
    console.log('Normalizados:', normalized.length);
    normalized.slice(0, 10).forEach((row, i) => {
      console.log(
        `  [${i}]`,
        row.analyteNameNormalized || row.analyteNameRaw,
        row.abnormalFlag,
        row.dashboardCategory
      );
    });
  } catch (e) {
    console.warn('Normalizacion omitida (DB no disponible):', (e as Error).message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
