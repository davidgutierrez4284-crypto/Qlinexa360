import React from 'react';
import { useSelectedDoctor } from '../../context/SelectedDoctorContext';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const ModuleDoctorSelector = ({ module, onSelectDoctor }) => {
  const { getDoctorsWithPermission, getSelectedDoctorForModule } = useSelectedDoctor();
  
  const availableDoctors = getDoctorsWithPermission(module);
  
  // Si no hay doctores disponibles para este módulo, no mostrar el selector
  if (availableDoctors.length === 0) {
    return null;
  }

  // Si solo hay un doctor, mostrar su nombre sin selector
  if (availableDoctors.length === 1) {
    return (
      <div className="text-xs text-gray-500 mt-1 ml-10">
        {availableDoctors[0].doctorName}
      </div>
    );
  }

  // Obtener el doctor seleccionado para este módulo específico
  const moduleDoctor = getSelectedDoctorForModule(module);
  const currentDoctor = moduleDoctor || availableDoctors.find(d => {
    const savedId = localStorage.getItem(`selectedDoctorId_${module}`);
    return savedId && d.doctorId === savedId;
  }) || availableDoctors[0];

  return (
    <div className="relative mt-1 ml-10">
      <select
        value={currentDoctor.doctorId}
        onChange={(e) => {
          const doctor = availableDoctors.find(d => d.doctorId === e.target.value);
          if (doctor && onSelectDoctor) {
            onSelectDoctor(doctor, module);
          }
        }}
        className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 text-xs px-2 py-1 pr-6 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        onClick={(e) => e.stopPropagation()}
      >
        {availableDoctors.map((doctor) => (
          <option key={doctor.doctorId} value={doctor.doctorId}>
            Prof. {doctor.doctorName}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="absolute right-1 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
    </div>
  );
};

export default ModuleDoctorSelector;

