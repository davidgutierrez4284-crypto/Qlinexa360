"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const labCompare_service_1 = require("../labCompare.service");
describe('labCompare buildReportResultDiffs', () => {
    const mk = (name, catalogId, value) => ({
        analyteCatalogId: catalogId,
        analyteNameRaw: name,
        analyteNameNormalized: name,
        resultValue: value,
    });
    it('pairs results by catalog id across reports', () => {
        var _a, _b, _c, _d;
        const a = [mk('Glucosa', 'id-glu', 90), mk('Hb', 'id-hb', 14)];
        const b = [mk('Glucosa', 'id-glu', 95), mk('Urea', 'id-urea', 30)];
        const diffs = (0, labCompare_service_1.buildReportResultDiffs)(a, b);
        expect(diffs).toHaveLength(3);
        expect((_a = diffs[0].reportA) === null || _a === void 0 ? void 0 : _a.resultValue).toBe(90);
        expect((_b = diffs[0].reportB) === null || _b === void 0 ? void 0 : _b.resultValue).toBe(95);
        expect((_c = diffs[1].reportA) === null || _c === void 0 ? void 0 : _c.resultValue).toBe(14);
        expect(diffs[1].reportB).toBeNull();
        expect(diffs[2].reportA).toBeNull();
        expect((_d = diffs[2].reportB) === null || _d === void 0 ? void 0 : _d.resultValue).toBe(30);
    });
    it('falls back to raw name when catalog id is missing', () => {
        var _a;
        const a = [mk('Parametro X', null, 1)];
        const b = [mk('Parametro X', null, 2)];
        const [diff] = (0, labCompare_service_1.buildReportResultDiffs)(a, b);
        expect((_a = diff.reportB) === null || _a === void 0 ? void 0 : _a.resultValue).toBe(2);
    });
});
describe('labCompare buildMultiReportResultDiffs', () => {
    const mk = (name, catalogId, value) => ({
        analyteCatalogId: catalogId,
        analyteNameRaw: name,
        analyteNameNormalized: name,
        resultValue: value,
    });
    it('merges analytes across three reports', () => {
        var _a, _b;
        const a = [mk('Glucosa', 'id-glu', 90)];
        const b = [mk('Glucosa', 'id-glu', 95), mk('Urea', 'id-urea', 30)];
        const c = [mk('Hb', 'id-hb', 14)];
        const diffs = (0, labCompare_service_1.buildMultiReportResultDiffs)([a, b, c]);
        expect(diffs).toHaveLength(3);
        expect(diffs[0].values).toEqual([a[0], b[0], null]);
        expect((_a = diffs[1].values[1]) === null || _a === void 0 ? void 0 : _a.resultValue).toBe(30);
        expect((_b = diffs[2].values[2]) === null || _b === void 0 ? void 0 : _b.resultValue).toBe(14);
    });
});
