import React, { useState } from 'react';

const CalendarReminderConfig = () => {
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState([5, 1]);
  const [message, setMessage] = useState('Estimado {{paciente}}, te recordamos que tienes una cita con {{doctor}} el {{fecha}} a las {{hora}}. Nos vemos en la consulta.');

  const handleAddDay = () => setDays([...days, '']);
  const handleDayChange = (idx, value) => {
    const newDays = [...days];
    newDays[idx] = value.replace(/[^0-9]/g, '');
    setDays(newDays);
  };
  const handleRemoveDay = (idx) => setDays(days.filter((_, i) => i !== idx));

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aquí lógica para guardar configuración
    alert('Configuración guardada (simulado)');
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-blue-700 mb-4">Configuración de Recordatorios por WhatsApp</h1>
      <div className="mb-4 p-4 bg-cyan-50 border-l-4 border-cyan-400 text-cyan-800 rounded">
        Recordatorios automáticos activados. Tus pacientes recibirán un mensaje por WhatsApp con la fecha y hora de la cita según tu configuración.
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 space-y-6">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} id="enable-reminders" />
          <label htmlFor="enable-reminders" className="font-medium">Activar recordatorios automáticos por WhatsApp</label>
        </div>
        <div>
          <label className="block font-medium mb-2">Días antes de la cita para enviar recordatorio:</label>
          <div className="flex flex-wrap gap-2">
            {days.map((day, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  type="text"
                  value={day}
                  onChange={e => handleDayChange(idx, e.target.value)}
                  className="w-16 px-2 py-1 border rounded"
                  placeholder="Día"
                />
                {days.length > 1 && (
                  <button type="button" onClick={() => handleRemoveDay(idx)} className="text-red-500 text-lg font-bold">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddDay} className="px-2 py-1 bg-blue-100 text-blue-700 rounded">+ Agregar día</button>
          </div>
        </div>
        <div>
          <label className="block font-medium mb-2">Mensaje personalizado:</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            className="w-full border rounded px-3 py-2"
          />
          <div className="text-xs text-gray-500 mt-1">
            Puedes usar las variables: {'{{paciente}}'}, {'{{doctor}}'}, {'{{fecha}}'}, {'{{hora}}'}
          </div>
        </div>
        <button type="submit" className="bg-cyan-700 text-white px-6 py-2 rounded font-semibold hover:bg-cyan-800">Guardar configuración</button>
      </form>
    </div>
  );
};

export default CalendarReminderConfig; 