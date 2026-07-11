const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const email = process.argv[2] || 'dava42@hotmail.com';
  const patient = await p.patient.findFirst({
    where: { user: { email: { contains: email.split('@')[0] } } },
    include: {
      user: { select: { email: true } },
      doctors: {
        orderBy: { startDate: 'asc' },
        include: { doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
      },
      clinicalCases: {
        include: {
          medicalRecords: { select: { doctorPatientId: true } },
          colaboradores: { include: { doctor: { include: { user: { select: { firstName: true, lastName: true } } } } } },
        },
      },
    },
  });

  if (!patient) {
    console.log('Paciente no encontrado');
    return;
  }

  console.log('\nPaciente:', patient.firstName, patient.lastName, '|', patient.user.email);
  console.log('\nVínculos doctor-paciente:');
  const dpMap = {};
  for (const dp of patient.doctors) {
    dpMap[dp.id] = `${dp.doctor.user.firstName} ${dp.doctor.user.lastName}`;
    console.log(
      `  - ${dp.doctor.user.firstName} ${dp.doctor.user.lastName} (${dp.doctor.user.email})`,
      `\n    visible portal: ${dp.clinicalHistoryVisibleToPatient}`,
      `\n    doctorPatientId: ${dp.id}`,
      `\n    startDate: ${dp.startDate.toISOString().slice(0, 10)}`
    );
  }

  console.log('\nCasos clínicos:');
  for (const c of patient.clinicalCases) {
    const byDp = {};
    for (const r of c.medicalRecords) {
      byDp[r.doctorPatientId] = (byDp[r.doctorPatientId] || 0) + 1;
    }
    console.log(`\n  ${c.padecimiento} (${c.medicalRecords.length} consultas)`);
    for (const [dpId, count] of Object.entries(byDp)) {
      const doctorName = dpMap[dpId] || dpId;
      const visible = patient.doctors.find((d) => d.id === dpId)?.clinicalHistoryVisibleToPatient;
      console.log(`    - ${count} consultas → ${doctorName} (visible paciente: ${visible})`);
    }
    if (c.colaboradores.length) {
      console.log(
        '    Colaboradores:',
        c.colaboradores.map((x) => `${x.doctor.user.firstName} ${x.doctor.user.lastName}`).join(', ')
      );
    }
  }
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
