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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoPendingSyncCron = void 0;
const cron = __importStar(require("node-cron"));
const database_1 = __importDefault(require("../../config/database"));
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_sync_service_1 = require("../../payments/mercadopago/mercadopago.sync.service");
const mercadopago_config_1 = require("../../payments/mercadopago/mercadopago.config");
/** Pagos pending más antiguos que esto se re-sincronizan con la API de MP. */
const MIN_AGE_MS = 2 * 60 * 60 * 1000;
const BATCH_LIMIT = 25;
class MercadoPagoPendingSyncCron {
    static start() {
        if (this.job || !mercadopago_config_1.mercadoPagoConfig.isConfigured()) {
            return;
        }
        this.job = cron.schedule('*/30 * * * *', () => {
            void this.run();
        });
        logger_utils_1.securityLogger.info('Cron MP pending sync programado (cada 30 minutos)');
    }
    static stop() {
        var _a;
        (_a = this.job) === null || _a === void 0 ? void 0 : _a.stop();
        this.job = null;
    }
    static async runManual(limit = BATCH_LIMIT) {
        return this.run(limit);
    }
    static async run(limit = BATCH_LIMIT) {
        const cutoff = new Date(Date.now() - MIN_AGE_MS);
        try {
            const pending = await database_1.default.mercadoPagoPayment.findMany({
                where: {
                    status: 'pending',
                    createdAt: { lte: cutoff },
                },
                select: { id: true },
                orderBy: { createdAt: 'asc' },
                take: limit,
            });
            if (pending.length === 0) {
                return { synced: 0, errors: 0 };
            }
            let synced = 0;
            let errors = 0;
            for (const row of pending) {
                try {
                    const updated = await (0, mercadopago_sync_service_1.syncPendingMercadoPagoPayment)(row.id);
                    if (updated && updated.status !== 'pending') {
                        synced += 1;
                    }
                }
                catch (err) {
                    errors += 1;
                    logger_utils_1.securityLogger.warn('MP pending sync cron: error en pago', { paymentId: row.id, err });
                }
            }
            if (synced > 0 || errors > 0) {
                logger_utils_1.securityLogger.info('MP pending sync cron finished', {
                    checked: pending.length,
                    synced,
                    errors,
                });
            }
            return { synced, errors, checked: pending.length };
        }
        catch (err) {
            logger_utils_1.securityLogger.error('MP pending sync cron failed', err);
            return { synced: 0, errors: 1 };
        }
    }
}
exports.MercadoPagoPendingSyncCron = MercadoPagoPendingSyncCron;
MercadoPagoPendingSyncCron.job = null;
