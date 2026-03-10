const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugCollaboration() {
  try {
    console.log('=== DEBUGGING COLLABORATION STATE ===\n');

    // 1. Find doctor3@test.com
    const doctor3 = await prisma.user.findUnique({
      where: { email: 'doctor3@test.com' },
      include: {
        doctorProfile: true
      }
    });

    console.log('1. Doctor3 info:');
    console.log('   User ID:', doctor3?.id);
    console.log('   Doctor ID:', doctor3?.doctorProfile?.id);
    console.log('   Email:', doctor3?.email);
    console.log('   Role:', doctor3?.role);
    console.log('');

    // 2. Find paciente@test.com
    const paciente = await prisma.user.findUnique({
      where: { email: 'paciente@test.com' },
      include: {
        patientProfile: {
          include: {
            clinicalCases: {
              include: {
                colaboradores: {
                  include: {
                    doctor: {
                      include: {
                        user: {
                          select: {
                            firstName: true,
                            lastName: true,
                            email: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log('2. Paciente info:');
    console.log('   User ID:', paciente?.id);
    console.log('   Patient ID:', paciente?.patientProfile?.id);
    console.log('   Email:', paciente?.email);
    console.log('');

    console.log('3. Clinical Cases for paciente@test.com:');
    paciente?.patientProfile?.clinicalCases.forEach((case_, index) => {
      console.log(`   Case ${index + 1}:`);
      console.log(`     ID: ${case_.id}`);
      console.log(`     Padecimiento: ${case_.padecimiento}`);
      console.log(`     Status: ${case_.status}`);
      console.log(`     Colaboradores: ${case_.colaboradores.length}`);
      case_.colaboradores.forEach((collab, collabIndex) => {
        console.log(`       Colaborador ${collabIndex + 1}: ${collab.doctor.user.firstName} ${collab.doctor.user.lastName} (${collab.doctor.user.email}) - Rol: ${collab.rol}`);
      });
      console.log('');
    });

    // 3. Check PadecimientoDoctorColaborador table
    const collaborations = await prisma.padecimientoDoctorColaborador.findMany({
      where: {
        doctorId: doctor3?.doctorProfile?.id
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        padecimiento: {
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log('4. PadecimientoDoctorColaborador entries for doctor3:');
    collaborations.forEach((collab, index) => {
      console.log(`   Collaboration ${index + 1}:`);
      console.log(`     ID: ${collab.id}`);
      console.log(`     Doctor: ${collab.doctor.user.firstName} ${collab.doctor.user.lastName} (${collab.doctor.user.email})`);
      console.log(`     Patient: ${collab.padecimiento.patient.user.firstName} ${collab.padecimiento.patient.user.lastName} (${collab.padecimiento.patient.user.email})`);
      console.log(`     Padecimiento: ${collab.padecimiento.padecimiento}`);
      console.log(`     Padecimiento ID: ${collab.padecimientoId}`);
      console.log(`     Patient ID: ${collab.patientId}`);
      console.log(`     Rol: ${collab.rol}`);
      console.log('');
    });

    // 4. Check if doctor3 is titular of any patients
    const titularPatients = await prisma.doctorPatient.findMany({
      where: {
        doctorId: doctor3?.doctorProfile?.id
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    console.log('5. Patients where doctor3 is titular:');
    titularPatients.forEach((link, index) => {
      console.log(`   Patient ${index + 1}: ${link.patient.user.firstName} ${link.patient.user.lastName} (${link.patient.user.email})`);
    });
    console.log('');

    // 5. Check what doctor3 should see according to current logic
    console.log('6. What doctor3 should see according to current logic:');
    
    // Direct patients (titular)
    const directPatients = await prisma.patient.findMany({
      where: {
        doctors: { some: { doctorId: doctor3?.doctorProfile?.id } }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        clinicalCases: {
          include: {
            colaboradores: {
              where: { doctorId: doctor3?.doctorProfile?.id }
            }
          }
        }
      }
    });

    console.log('   Direct patients (titular):');
    directPatients.forEach((patient, index) => {
      console.log(`     Patient ${index + 1}: ${patient.user.firstName} ${patient.user.lastName} (${patient.user.email})`);
      patient.clinicalCases.forEach((case_, caseIndex) => {
        console.log(`       Case ${caseIndex + 1}: ${case_.padecimiento} (ID: ${case_.id})`);
      });
    });

    // Collaborative patients
    const collaborativePatients = await prisma.patient.findMany({
      where: {
        clinicalCases: { 
          some: { 
            colaboradores: { 
              some: { doctorId: doctor3?.doctorProfile?.id } 
            } 
          } 
        },
        doctors: { none: { doctorId: doctor3?.doctorProfile?.id } } // Not titular
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        clinicalCases: {
          include: {
            colaboradores: {
              where: { doctorId: doctor3?.doctorProfile?.id }
            }
          }
        }
      }
    });

    console.log('   Collaborative patients:');
    collaborativePatients.forEach((patient, index) => {
      console.log(`     Patient ${index + 1}: ${patient.user.firstName} ${patient.user.lastName} (${patient.user.email})`);
      patient.clinicalCases.forEach((case_, caseIndex) => {
        console.log(`       Case ${caseIndex + 1}: ${case_.padecimiento} (ID: ${case_.id})`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCollaboration();
