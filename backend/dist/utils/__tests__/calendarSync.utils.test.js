"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const calendarSync_utils_1 = require("../calendarSync.utils");
describe('resolveGoogleCalendarSendUpdates', () => {
    it('returns none when there are no attendees', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: null,
            attendeeCount: 0,
        })).toBe('none');
    });
    it('returns all for new event create with explicit notifyAttendees', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: null,
            attendeeCount: 1,
            notifyAttendees: true,
        })).toBe('all');
    });
    it('returns none for syncAppointmentCalendars when notifyAttendees omitted (prevents email loops)', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: 'google-event-abc',
            attendeeCount: 1,
        })).toBe('none');
    });
    it('returns none for intentional silent second-pass alignment after create', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: 'google-event-abc',
            attendeeCount: 1,
            notifyAttendees: false,
        })).toBe('none');
    });
    it('returns all when patient confirms appointment (responseStatus accepted)', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: 'google-event-abc',
            attendeeCount: 1,
            responseStatus: 'accepted',
        })).toBe('all');
    });
    it('returns all on reschedule with notifyAttendees true', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: 'google-event-abc',
            attendeeCount: 1,
            notifyAttendees: true,
        })).toBe('all');
    });
});
describe('externalCalendarEventNeedsUpdate', () => {
    const baseExisting = {
        summary: '🏥 prod virtual con MP consulta',
        description: 'Cita con Dr. Test',
        startMs: new Date('2026-07-30T15:00:00.000Z').getTime(),
        endMs: new Date('2026-07-30T15:30:00.000Z').getTime(),
        attendeeEmails: ['patient@hotmail.com'],
        attendeeResponseStatus: 'accepted',
        hasVideoConference: true,
        location: '',
    };
    it('returns false when normalized payload matches Google event', () => {
        expect((0, calendarSync_utils_1.externalCalendarEventNeedsUpdate)(baseExisting, Object.assign(Object.assign({}, baseExisting), { summary: 'prod virtual con MP consulta' }))).toBe(false);
    });
    it('returns true when start time changes beyond tolerance', () => {
        expect((0, calendarSync_utils_1.externalCalendarEventNeedsUpdate)(baseExisting, Object.assign(Object.assign({}, baseExisting), { startMs: baseExisting.startMs + 5 * 60 * 1000 }))).toBe(true);
    });
    it('returns true when Meet link is added', () => {
        expect((0, calendarSync_utils_1.externalCalendarEventNeedsUpdate)(Object.assign(Object.assign({}, baseExisting), { hasVideoConference: false }), Object.assign(Object.assign({}, baseExisting), { hasVideoConference: true }))).toBe(true);
    });
    it('returns false when attendee response already matches', () => {
        expect((0, calendarSync_utils_1.externalCalendarEventNeedsUpdate)(baseExisting, Object.assign(Object.assign({}, baseExisting), { attendeeResponseStatus: 'accepted' }))).toBe(false);
    });
});
describe('normalizeGoogleCalendarSummary', () => {
    it('strips emoji and trailing consulta', () => {
        expect((0, calendarSync_utils_1.normalizeGoogleCalendarSummary)('🏥 Paciente consulta')).toBe('paciente');
    });
});
