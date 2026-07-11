// Función para formatear fecha en formato DD-MMM-YY
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('es-ES', { month: 'short' }).substring(0, 3);
  const year = date.getFullYear().toString().slice(-2);
  
  return `${day}-${month}-${year}`;
};

/** Finanzas MP: 02-Jul-2026 08:51:34 a.m. */
export const formatFinanzasDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `${day}-${month}-${year} ${time}`;
};

// Función para formatear fecha completa
export const formatFullDate = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}; 