import React from 'react';
import { useSelectedDoctor } from '../../context/SelectedDoctorContext';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const DoctorSelector = () => {
  const { selectedDoctor, linkedDoctors, selectDoctor, loading } = useSelectedDoctor();

  if (loading) {
    return (
      <div className="px-3 py-2 text-white text-sm">
        Cargando doctores...
      </div>
    );
  }

  if (!selectedDoctor || linkedDoctors.length === 0) {
    return null;
  }

  if (linkedDoctors.length === 1) {
    return (
      <div className="px-1 sm:px-2 py-1.5 text-white text-xs sm:text-sm truncate max-w-full" title={selectedDoctor.doctorName}>
        {selectedDoctor.doctorName}
      </div>
    );
  }

  return (
    <div className="relative min-w-0 max-w-[120px] sm:max-w-[140px] md:max-w-none">
      <select
        value={selectedDoctor.doctorId}
        onChange={(e) => {
          const doctor = linkedDoctors.find(d => d.doctorId === e.target.value);
          if (doctor) {
            selectDoctor(doctor);
          }
        }}
        className="appearance-none bg-indigo-700 hover:bg-indigo-800 text-white px-2 sm:px-3 py-1.5 sm:py-2 pr-6 sm:pr-8 rounded-md text-xs sm:text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-full truncate"
      >
        {linkedDoctors.map((doctor) => (
          <option key={doctor.doctorId} value={doctor.doctorId}>
            Prof. {doctor.doctorName}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
    </div>
  );
};

export default DoctorSelector;

