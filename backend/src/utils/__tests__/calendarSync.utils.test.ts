import {
  externalCalendarEventNeedsUpdate,
  normalizeGoogleCalendarSummary,
  resolveGoogleCalendarSendUpdates,
} from '../calendarSync.utils';

describe('resolveGoogleCalendarSendUpdates', () => {
  it('returns none when there are no attendees', () => {
    expect(
      resolveGoogleCalendarSendUpdates({
        externalEventId: null,
        attendeeCount: 0,
      })
    ).toBe('none');
  });

  it('returns all for new event create with explicit notifyAttendees', () => {
    expect(
      resolveGoogleCalendarSendUpdates({
        externalEventId: null,
        attendeeCount: 1,
        notifyAttendees: true,
      })
    ).toBe('all');
  });

  it('returns none for syncAppointmentCalendars when notifyAttendees omitted (prevents email loops)', () => {
    expect(
      resolveGoogleCalendarSendUpdates({
        externalEventId: 'google-event-abc',
        attendeeCount: 1,
      })
    ).toBe('none');
  });

  it('returns none for intentional silent second-pass alignment after create', () => {
    expect(
      resolveGoogleCalendarSendUpdates({
        externalEventId: 'google-event-abc',
        attendeeCount: 1,
        notifyAttendees: false,
      })
    ).toBe('none');
  });

  it('returns all when patient confirms appointment (responseStatus accepted)', () => {
    expect(
      resolveGoogleCalendarSendUpdates({
        externalEventId: 'google-event-abc',
        attendeeCount: 1,
        responseStatus: 'accepted',
      })
    ).toBe('all');
  });

  it('returns all on reschedule with notifyAttendees true', () => {
    expect(
      resolveGoogleCalendarSendUpdates({
        externalEventId: 'google-event-abc',
        attendeeCount: 1,
        notifyAttendees: true,
      })
    ).toBe('all');
  });
});

describe('externalCalendarEventNeedsUpdate', () => {
  const baseExisting = {
    summary: '🏥 prod virtual con MP consulta',
    description: 'Cita con Dr. Test',
    startMs: new Date('2026-07-30T15:00:00.000Z').getTime(),
    endMs: new Date('2026-07-30T15:30:00.000Z').getTime(),
    attendeeEmails: ['patient@hotmail.com'],
    attendeeResponseStatus: 'accepted' as const,
    hasVideoConference: true,
    location: '',
  };

  it('returns false when normalized payload matches Google event', () => {
    expect(
      externalCalendarEventNeedsUpdate(baseExisting, {
        ...baseExisting,
        summary: 'prod virtual con MP consulta',
      })
    ).toBe(false);
  });

  it('returns true when start time changes beyond tolerance', () => {
    expect(
      externalCalendarEventNeedsUpdate(baseExisting, {
        ...baseExisting,
        startMs: baseExisting.startMs + 5 * 60 * 1000,
      })
    ).toBe(true);
  });

  it('returns true when Meet link is added', () => {
    expect(
      externalCalendarEventNeedsUpdate(
        { ...baseExisting, hasVideoConference: false },
        { ...baseExisting, hasVideoConference: true }
      )
    ).toBe(true);
  });

  it('returns false when attendee response already matches', () => {
    expect(
      externalCalendarEventNeedsUpdate(baseExisting, {
        ...baseExisting,
        attendeeResponseStatus: 'accepted',
      })
    ).toBe(false);
  });
});

describe('normalizeGoogleCalendarSummary', () => {
  it('strips emoji and trailing consulta', () => {
    expect(normalizeGoogleCalendarSummary('🏥 Paciente consulta')).toBe('paciente');
  });
});
