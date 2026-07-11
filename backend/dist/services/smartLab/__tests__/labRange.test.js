"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const labRange_utils_1 = require("../../../utils/labRange.utils");
describe('labRange computeAbnormalFlag', () => {
    it('returns normal inside range', () => {
        expect((0, labRange_utils_1.computeAbnormalFlag)(90, 70, 100)).toBe('normal');
    });
    it('returns high when moderately above max', () => {
        expect((0, labRange_utils_1.computeAbnormalFlag)(120, 70, 100)).toBe('high');
    });
    it('returns critical_high when far above max', () => {
        expect((0, labRange_utils_1.computeAbnormalFlag)(200, 70, 100)).toBe('critical_high');
    });
    it('returns low and critical_low below min', () => {
        expect((0, labRange_utils_1.computeAbnormalFlag)(65, 70, 100)).toBe('low');
        expect((0, labRange_utils_1.computeAbnormalFlag)(20, 70, 100)).toBe('critical_low');
    });
    it('returns unknown without value or range', () => {
        expect((0, labRange_utils_1.computeAbnormalFlag)(null, 70, 100)).toBe('unknown');
        expect((0, labRange_utils_1.computeAbnormalFlag)(90, null, null)).toBe('unknown');
    });
    it('handles one-sided reference ranges', () => {
        expect((0, labRange_utils_1.computeAbnormalFlag)(260, null, 200)).toBe('high');
        expect((0, labRange_utils_1.computeAbnormalFlag)(180, null, 200)).toBe('normal');
        expect((0, labRange_utils_1.computeAbnormalFlag)(45, 60, null)).toBe('low');
        expect((0, labRange_utils_1.computeAbnormalFlag)(65, 60, null)).toBe('normal');
        expect((0, labRange_utils_1.computeAbnormalFlag)(5.8, null, 4.5)).toBe('high');
    });
});
