'use strict';
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const APPEND_BLOCK = `
enum LabReportStatus {
  uploaded
  processing
  extraction_failed
  pending_review
  confirmed
  rejected
  archived
}

enum LabAbnormalFlag {
  low
  high
  normal
  critical_low
  critical_high
  unknown
}

enum LabAlertType {
  out_of_range
  trend_up
  trend_down
  critical
  missing_followup
  significant_change
}

enum LabSeverity {
  green
  yellow
  red
  gray
}

enum LabAuditAction {
  upload
  extract
  extract_failed
  review
  manual_correction
  confirm
  reject
  view
  download
  archive
  delete
}

model LabReport {
  id                   String           @id @default(uuid())
  patientId            String
  doctorId             String?
  clinicId             String?
  laboratoryName       String?
  studyType            String?
  studyDate            DateTime?
  reportDate           DateTime?
  sourcePdfUrl         String
  fileHash             String
  extractionStatus     LabReportStatus  @default(uploaded)
  extractionEngine     String?
  extractionConfidence Float?
  rawText              String?          @db.Text
  reviewedByUserId     String?
  confirmedAt          DateTime?
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
  patient              Patient          @relation(fields: [patientId], references: [id])
  doctor               Doctor?          @relation(fields: [doctorId], references: [id])
  reviewedBy             User?            @relation("LabReportReviewedBy", fields: [reviewedByUserId], references: [id])
  results              LabResult[]

  @@index([patientId, studyDate])
  @@index([doctorId])
}

model LabResult {
  id                    String            @id @default(uuid())
  labReportId           String
  patientId             String
  analyteCatalogId      String?
  analyteNameRaw        String
  analyteNameNormalized String?
  resultValue           Float?
  resultValueText       String?
  resultUnit            String?
  referenceRangeLow     Float?
  referenceRangeHigh    Float?
  referenceRangeText    String?
  abnormalFlag          LabAbnormalFlag   @default(unknown)
  extractionConfidence  Float?
  rawTextSnippet        String?
  manuallyCorrected     Boolean           @default(false)
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  labReport             LabReport         @relation(fields: [labReportId], references: [id], onDelete: Cascade)
  patient               Patient           @relation(fields: [patientId], references: [id])
  analyteCatalog        LabAnalyteCatalog? @relation(fields: [analyteCatalogId], references: [id])
  alerts                LabAlert[]

  @@index([labReportId])
  @@index([patientId, analyteCatalogId])
}

model LabAnalyteCatalog {
  id                  String      @id @default(uuid())
  category            String
  name                String
  aliasesJson         Json        @default("[]")
  defaultUnit         String?
  defaultReferenceLow Float?
  defaultReferenceHigh Float?
  referenceNotes      String?
  sexSpecific         Boolean     @default(false)
  ageSpecific         Boolean     @default(false)
  active              Boolean     @default(true)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  results             LabResult[]
  alerts              LabAlert[]

  @@index([category])
  @@index([name])
}

model LabAlert {
  id                String             @id @default(uuid())
  patientId         String
  labResultId       String?
  analyteCatalogId  String?
  alertType         LabAlertType
  severity          LabSeverity
  title             String
  message           String
  createdAt         DateTime           @default(now())
  dismissedAt       DateTime?
  dismissedByUserId   String?
  patient           Patient            @relation(fields: [patientId], references: [id])
  labResult         LabResult?         @relation(fields: [labResultId], references: [id], onDelete: SetNull)
  analyteCatalog    LabAnalyteCatalog? @relation(fields: [analyteCatalogId], references: [id])
  dismissedBy       User?              @relation("LabAlertDismissedBy", fields: [dismissedByUserId], references: [id])

  @@index([patientId])
}

model LabHealthDashboardScore {
  id            String      @id @default(uuid())
  patientId     String
  category      String
  status        LabSeverity
  score         Float?
  summary       String?
  lastUpdatedAt DateTime    @default(now())
  patient       Patient     @relation(fields: [patientId], references: [id])

  @@unique([patientId, category])
}

model LabAuditLog {
  id          String         @id @default(uuid())
  actorUserId String?
  patientId   String?
  labReportId String?
  action      LabAuditAction
  metadata    Json?
  createdAt   DateTime       @default(now())
  actor       User?          @relation("LabAuditActor", fields: [actorUserId], references: [id])

  @@index([patientId])
  @@index([labReportId])
}
`;

const RELATIONS = {
  Patient: [
    '  labReports                LabReport[]',
    '  labResults                LabResult[]',
    '  labAlerts                 LabAlert[]',
    '  labDashboardScores        LabHealthDashboardScore[]',
  ],
  Doctor: ['  labReports                 LabReport[]'],
  User: [
    '  labReportsReviewed         LabReport[]                @relation("LabReportReviewedBy")',
    '  labAlertsDismissed         LabAlert[]                 @relation("LabAlertDismissedBy")',
    '  labAuditLogs               LabAuditLog[]              @relation("LabAuditActor")',
  ],
};

function findModelBlock(content, modelName) {
  const re = new RegExp('model ' + modelName + ' \\{');
  const start = content.search(re);
  if (start === -1) return null;
  let depth = 0;
  let i = content.indexOf('{', start);
  for (; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: i };
    }
  }
  return null;
}

function injectRelations(content, modelName, lines) {
  const block = findModelBlock(content, modelName);
  if (!block) throw new Error('Model not found: ' + modelName);
  const slice = content.slice(block.start, block.end);
  const marker = lines[0].trim().split(/\s+/)[0];
  if (slice.includes(marker)) return content;
  const insert = '\n' + lines.join('\n') + '\n';
  return content.slice(0, block.end) + insert + content.slice(block.end);
}

function main() {
  let content = fs.readFileSync(schemaPath, 'utf8');
  if (/model\s+LabReport\s*\{/.test(content)) {
    console.log('LabReport already present in schema.prisma — skipping patch.');
    return;
  }
  for (const [model, lines] of Object.entries(RELATIONS)) {
    content = injectRelations(content, model, lines);
  }
  content = content.trimEnd() + '\n' + APPEND_BLOCK.trim() + '\n';
  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log('Patched schema.prisma with Smart Lab models and relations.');
}

main();