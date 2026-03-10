// Función para formatear fecha en formato DD-MMM-YY
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('es-ES', { month: 'short' }).substring(0, 3);
  const year = date.getFullYear().toString().slice(-2);
  
  return `${day}-${month}-${year}`;
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