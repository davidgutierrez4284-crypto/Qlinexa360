/**
 * Genera contenido .ics para agregar eventos al calendario del paciente
 */
export function generateIcsForAppointment(params: {
  eventId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
}): string {
  const formatDate = (date: Date) => {
    const iso = date.toISOString();
    return iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeText = (text?: string | null) => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  };

  const uid = `${params.eventId}@qlinexa360.com`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Qlinexa360//Calendar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(params.start)}`,
    `DTEND:${formatDate(params.end)}`,
    `SUMMARY:${escapeText(params.title)}`,
    params.description ? `DESCRIPTION:${escapeText(params.description)}` : undefined,
    params.location ? `LOCATION:${escapeText(params.location)}` : undefined,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean) as string[];

  return lines.join('\r\n');
}
