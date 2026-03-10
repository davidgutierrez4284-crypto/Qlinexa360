"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionResumeCron = void 0;
const cron = __importStar(require("node-cron"));
const subscription_controller_1 = require("../../controllers/subscription.controller");
const logger_utils_1 = require("../../utils/logger.utils");
/**
 * Cron que reanuda suscripciones cuyo mes gratis ya terminó (resumeDate <= hoy).
 * Corre diariamente a las 6:00 AM (hora del servidor).
 */
class SubscriptionResumeCron {
    static start() {
        if (!this.job) {
            this.job = cron.schedule('0 6 * * *', () => this.run());
            logger_utils_1.securityLogger.info('Cron de reanudación de suscripciones (mes gratis) programado (diario 6:00 AM)');
        }
    }
    static stop() {
        var _a;
        (_a = this.job) === null || _a === void 0 ? void 0 : _a.stop();
        this.job = null;
    }
    static async run() {
        try {
            const { count, results } = await (0, subscription_controller_1.runResumeSuspendedSubscriptions)();
            if (count > 0) {
                const resumed = results.filter((r) => r.status === 'resumed');
                const errors = results.filter((r) => r.status === 'error');
                logger_utils_1.securityLogger.info(`Cron reanudación suscripciones: ${count} procesadas, ${resumed.length} reanudadas, ${errors.length} errores`);
                if (errors.length > 0) {
                    logger_utils_1.securityLogger.warn('Errores en reanudación:', JSON.stringify(errors));
                }
            }
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error en cron de reanudación de suscripciones:', error);
        }
    }
}
exports.SubscriptionResumeCron = SubscriptionResumeCron;
SubscriptionResumeCron.job = null;
exports.default = SubscriptionResumeCron;
