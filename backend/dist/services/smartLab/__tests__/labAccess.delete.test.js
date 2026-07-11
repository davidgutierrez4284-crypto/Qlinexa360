"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const labAccess_service_1 = require("../labAccess.service");
const error_utils_1 = require("../../../utils/error.utils");
describe('labAccess roles for lab report delete', () => {
    it('allows DOCTOR, ASISTENTE and PATIENT', () => {
        expect(() => (0, labAccess_service_1.assertLabRole)('DOCTOR')).not.toThrow();
        expect(() => (0, labAccess_service_1.assertLabRole)('ASISTENTE')).not.toThrow();
        expect(() => (0, labAccess_service_1.assertLabRole)('PATIENT')).not.toThrow();
    });
    it('rejects roles without lab module access', () => {
        expect(() => (0, labAccess_service_1.assertLabRole)('GUEST')).toThrow(error_utils_1.AppError);
    });
});
