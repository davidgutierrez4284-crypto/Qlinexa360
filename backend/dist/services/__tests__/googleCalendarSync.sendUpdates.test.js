"use strict";
/**
 * Verifies sendUpdates defaults in GoogleCalendarSyncService match legacy notify-on-attendee behavior.
 * Google API is mocked — no network calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mockCalendarFindFirst = jest.fn();
const mockCalendarUpdate = jest.fn();
const mockCalendarUpdateMany = jest.fn();
const mockDoctorFindUnique = jest.fn();
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        doctor: { findUnique: mockDoctorFindUnique },
        calendarSyncConfig: {
            findFirst: mockCalendarFindFirst,
            update: mockCalendarUpdate,
            updateMany: mockCalendarUpdateMany,
        },
    })),
}));
jest.mock('../oauth.service', () => ({
    OAuthService: { refreshAccessToken: jest.fn() },
}));
jest.mock('../../utils/calendarAuth.utils', () => ({
    notifyCalendarReconnectNeeded: jest.fn(),
}));
jest.mock('../../config/oauth.config', () => ({
    getOAuthConfig: jest.fn().mockReturnValue({
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'http://localhost/callback',
    }),
}));
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockGet = jest.fn();
jest.mock('googleapis', () => ({
    google: {
        calendar: jest.fn(() => ({
            events: {
                insert: mockInsert,
                update: mockUpdate,
                get: mockGet,
            },
        })),
        auth: {
            OAuth2: jest.fn().mockImplementation(() => ({
                setCredentials: jest.fn(),
            })),
        },
    },
}));
const googleCalendarSync_service_1 = require("../googleCalendarSync.service");
const calendarSync_utils_1 = require("../../utils/calendarSync.utils");
const basePayload = {
    id: 'evt-1',
    title: 'Paciente consulta',
    start: new Date('2026-07-30T15:00:00.000Z'),
    end: new Date('2026-07-30T15:30:00.000Z'),
    attendees: ['patient@hotmail.com'],
};
beforeEach(() => {
    jest.clearAllMocks();
    mockDoctorFindUnique.mockResolvedValue({ timezone: 'America/Mexico_City' });
    mockCalendarFindFirst.mockResolvedValue({
        id: 'cfg-1',
        doctorId: 'doc-1',
        provider: 'google',
        isConnected: true,
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600000),
    });
    mockCalendarUpdate.mockResolvedValue({});
    mockCalendarUpdateMany.mockResolvedValue({ count: 1 });
    mockInsert.mockResolvedValue({
        data: { id: 'google-new-id', updated: new Date().toISOString() },
    });
    mockUpdate.mockResolvedValue({
        data: { id: 'google-existing-id', updated: new Date().toISOString() },
    });
    mockGet.mockResolvedValue({
        data: {
            id: 'google-existing-id',
            summary: 'Old title',
            attendees: [],
        },
    });
});
describe('GoogleCalendarSyncService sendUpdates integration', () => {
    it('insert uses sendUpdates all by default when creating with attendees', async () => {
        await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent('doc-1', basePayload);
        expect(mockInsert).toHaveBeenCalledTimes(1);
        expect(mockInsert.mock.calls[0][0].sendUpdates).toBe('all');
    });
    it('update defaults to sendUpdates none when not explicitly requested', async () => {
        await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent('doc-1', Object.assign(Object.assign({}, basePayload), { externalEventId: 'google-existing-id' }));
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockUpdate.mock.calls[0][0].sendUpdates).toBe('none');
    });
    it('skips Google update when event payload is unchanged', async () => {
        mockGet.mockResolvedValue({
            data: {
                id: 'google-existing-id',
                summary: '🏥 Paciente consulta',
                description: 'Desc',
                start: { dateTime: '2026-07-30T09:00:00-06:00' },
                end: { dateTime: '2026-07-30T09:30:00-06:00' },
                attendees: [{ email: 'patient@hotmail.com', responseStatus: 'needsAction' }],
                location: '',
            },
        });
        await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent('doc-1', Object.assign(Object.assign({}, basePayload), { title: 'Paciente consulta', description: 'Desc', externalEventId: 'google-existing-id' }));
        expect(mockUpdate).not.toHaveBeenCalled();
    });
    it('update respects explicit sendUpdates none from controller silent sync', async () => {
        await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent('doc-1', Object.assign(Object.assign({}, basePayload), { externalEventId: 'google-existing-id', sendUpdates: 'none' }));
        expect(mockUpdate.mock.calls[0][0].sendUpdates).toBe('none');
    });
    it('throws GoogleCalendarNotReadyError when doctor has no google config (no silent null)', async () => {
        mockCalendarFindFirst.mockResolvedValue(null);
        await expect(googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent('doc-1', basePayload)).rejects.toBeInstanceOf(googleCalendarSync_service_1.GoogleCalendarNotReadyError);
        expect(mockInsert).not.toHaveBeenCalled();
    });
});
describe('calendar flow sendUpdates resolution', () => {
    it('create presencial first sync notifies attendees', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: null,
            attendeeCount: 1,
            notifyAttendees: true,
        })).toBe('all');
    });
    it('confirm appointment notifies attendees without explicit notifyAttendees flag', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: 'google-existing-id',
            attendeeCount: 1,
            responseStatus: 'accepted',
        })).toBe('all');
    });
    it('reschedule notifies when notifyAttendees true', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: 'google-existing-id',
            attendeeCount: 1,
            notifyAttendees: true,
        })).toBe('all');
    });
    it('syncAppointmentCalendars silent path does not notify by default', () => {
        expect((0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
            externalEventId: 'google-existing-id',
            attendeeCount: 1,
        })).toBe('none');
    });
});
