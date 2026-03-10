const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugFrontendIssues() {
  try {
    console.log('=== DIAGNÓSTICO DE PROBLEMAS DEL FRONTEND ===\n');

    // Buscar el doctor3@test.com
    const doctor3 = await prisma.user.findUnique({
      where: { email: 'doctor3@test.com' },
      include: {
        doctorProfile: true
      }
    });

    if (!doctor3) {
      console.log('❌ doctor3@test.com no encontrado');
      return;
    }

    console.log('👨‍⚕️ Doctor3:', `${doctor3.firstName} ${doctor3.lastName} (ID: ${doctor3.doctorProfile.id})`);

    // ===== SIMULAR getAllMyPatients =====
    console.log('\n🔍 SIMULANDO getAllMyPatients:');
    
    // Obtener pacientes directamente asociados al doctor (TITULARES)
    const directPatients = await prisma.patient.findMany({
      where: {
        doctors: { some: { doctorId: doctor3.doctorProfile.id } }
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
            medicalRecords: {
              orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' }
              ],
              select: {
                id: true,
                clinicalEvolution: true,
                createdAt: true,
                date: true
              }
            },
            colaboradores: {
              include: {
                doctor: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        doctors: {
          where: { doctorId: doctor3.doctorProfile.id },
          include: {
            doctor: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`   directPatients: ${directPatients.length}`);
    directPatients.forEach((patient, index) => {
      console.log(`     ${index + 1}: ${patient.user.firstName} ${patient.user.lastName} (${patient.user.email})`);
      console.log(`        Es titular: ${patient.doctors.length > 0 ? 'SÍ' : 'NO'}`);
      console.log(`        Casos clínicos: ${patient.clinicalCases.length}`);
      
      patient.clinicalCases.forEach((case_, caseIndex) => {
        console.log(`          Caso ${caseIndex + 1}: ${case_.padecimiento}`);
        console.log(`            Colaboradores: ${case_.colaboradores.length}`);
      });
    });

    // Obtener pacientes con los que el doctor colabora (COLABORADORES)
    const collaborativePatients = await prisma.patient.findMany({
      where: {
        AND: [
          {
            clinicalCases: { 
              some: { 
                colaboradores: { 
                  some: { doctorId: doctor3.doctorProfile.id } 
                } 
              } 
            }
          },
          {
            doctors: {
              none: { doctorId: doctor3.doctorProfile.id }
            }
          }
        ]
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
          where: {
            colaboradores: {
              some: { doctorId: doctor3.doctorProfile.id }
            }
          },
          include: {
            medicalRecords: {
              orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' }
              ],
              select: {
                id: true,
                clinicalEvolution: true,
                createdAt: true,
                date: true
              }
            },
            colaboradores: {
              include: {
                doctor: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        doctors: {
          include: {
            doctor: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`   collaborativePatients: ${collaborativePatients.length}`);
    collaborativePatients.forEach((patient, index) => {
      console.log(`     ${index + 1}: ${patient.user.firstName} ${patient.user.lastName} (${patient.user.email})`);
      console.log(`        Es titular: ${patient.doctors.length > 0 ? 'SÍ' : 'NO'}`);
      console.log(`        Casos clínicos: ${patient.clinicalCases.length}`);
      
      patient.clinicalCases.forEach((case_, caseIndex) => {
        console.log(`          Caso ${caseIndex + 1}: ${case_.padecimiento}`);
        console.log(`            Colaboradores: ${case_.colaboradores.length}`);
      });
    });

    // Combinar pacientes
    const allPatients = [...directPatients, ...collaborativePatients];
    console.log(`   Total pacientes: ${allPatients.length}`);

    // ===== SIMULAR searchPatientsForRecipes =====
    console.log('\n🔍 SIMULANDO searchPatientsForRecipes:');
    
    // Buscar pacientes directamente asociados al doctor (TITULARES)
    const directPatientsForRecipes = await prisma.patient.findMany({
      where: {
        doctors: { some: { doctorId: doctor3.doctorProfile.id } }
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
          select: {
            id: true,
            padecimiento: true
          }
        },
        doctors: {
          where: { doctorId: doctor3.doctorProfile.id },
          select: {
            id: true
          }
        }
      }
    });

    // Buscar pacientes donde el doctor es colaborador (COLABORADORES)
    const collaborativePatientsForRecipes = await prisma.patient.findMany({
      where: {
        AND: [
          {
            clinicalCases: { 
              some: { 
                colaboradores: { 
                  some: { doctorId: doctor3.doctorProfile.id } 
                } 
              } 
            }
          },
          {
            doctors: {
              none: { doctorId: doctor3.doctorProfile.id }
            }
          }
        ]
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
          where: {
            colaboradores: {
              some: { doctorId: doctor3.doctorProfile.id }
            }
          },
          select: {
            id: true,
            padecimiento: true
          }
        },
        doctors: {
          where: { doctorId: doctor3.doctorProfile.id },
          select: {
            id: true
          }
        }
      }
    });

    const allPatientsForRecipes = [...directPatientsForRecipes, ...collaborativePatientsForRecipes];
    
    console.log(`   Pacientes para recetas: ${allPatientsForRecipes.length}`);
    allPatientsForRecipes.forEach((patient, index) => {
      const isTitular = patient.doctors && patient.doctors.length > 0;
      console.log(`     ${index + 1}: ${patient.user.firstName} ${patient.user.lastName} (${patient.user.email})`);
      console.log(`        Es titular: ${isTitular ? 'SÍ' : 'NO'}`);
      console.log(`        Es colaborador: ${!isTitular ? 'SÍ' : 'NO'}`);
      console.log(`        Casos clínicos: ${patient.clinicalCases.length}`);
    });

    // ===== SIMULAR getPatientDetails =====
    console.log('\n🔍 SIMULANDO getPatientDetails para paciente@test.com:');
    
    const paciente = await prisma.user.findUnique({
      where: { email: 'paciente@test.com' },
      include: {
        patientProfile: true
      }
    });

    if (paciente) {
      // Verificar si el doctor es titular
      const doctorPatientLink = await prisma.doctorPatient.findUnique({
        where: { 
          doctorId_patientId: { 
            doctorId: doctor3.doctorProfile.id, 
            patientId: paciente.patientProfile.id
          } 
        }
      });

      console.log(`   Es titular: ${doctorPatientLink ? 'SÍ' : 'NO'}`);

      // Si no es titular, verificar si es colaborador
      let collaborativeCaseIds = [];
      if (!doctorPatientLink) {
        const collaborationCheck = await prisma.padecimientoDoctorColaborador.findMany({
          where: {
            doctor: { userId: doctor3.id },
            patientId: paciente.patientProfile.id
          },
          select: {
            padecimientoId: true
          }
        });
        
        collaborativeCaseIds = collaborationCheck.map(c => c.padecimientoId);
        console.log(`   Es colaborador: ${collaborationCheck.length > 0 ? 'SÍ' : 'NO'}`);
        console.log(`   Casos colaborativos: ${collaborativeCaseIds.length}`);
      }

      // Obtener el paciente con casos clínicos filtrados
      const patientDetails = await prisma.patient.findUnique({
        where: { id: paciente.patientProfile.id },
        include: {
          user: true,
          emergencyContacts: true,
          clinicalCases: {
            where: !doctorPatientLink ? { id: { in: collaborativeCaseIds } } : undefined,
            include: {
              medicalRecords: { 
                orderBy: { createdAt: 'desc' },
                include: { 
                  doctorPatient: { 
                    include: { 
                      doctor: { 
                        select: { 
                          user: { select: { firstName: true, lastName: true } } 
                        } 
                      } 
                    } 
                  } 
                } 
              },
              colaboradores: {
                include: {
                  doctor: {
                    include: {
                      user: {
                        select: {
                          firstName: true,
                          lastName: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
      });

      console.log(`   Casos clínicos visibles: ${patientDetails?.clinicalCases?.length || 0}`);
      patientDetails?.clinicalCases?.forEach((case_, index) => {
        console.log(`     Caso ${index + 1}: ${case_.padecimiento}`);
      });
    }

    console.log('\n✅ DIAGNÓSTICO COMPLETADO');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFrontendIssues();
