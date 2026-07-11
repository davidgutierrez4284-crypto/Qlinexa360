"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const labAlerts_service_1 = require("../labAlerts.service");
describe('labAlerts severity mapping', () => {
    it('maps critical flags to red', () => {
        expect((0, labAlerts_service_1.mapAbnormalFlagToLabSeverity)('critical_high')).toBe('red');
        expect((0, labAlerts_service_1.mapAbnormalFlagToLabSeverity)('critical_low')).toBe('red');
    });
    it('maps borderline flags to yellow', () => {
        expect((0, labAlerts_service_1.mapAbnormalFlagToLabSeverity)('high')).toBe('yellow');
        expect((0, labAlerts_service_1.mapAbnormalFlagToLabSeverity)('low')).toBe('yellow');
    });
    it('maps normal to green and unknown to gray', () => {
        expect((0, labAlerts_service_1.mapAbnormalFlagToLabSeverity)('normal')).toBe('green');
        expect((0, labAlerts_service_1.mapAbnormalFlagToLabSeverity)('unknown')).toBe('gray');
    });
});
