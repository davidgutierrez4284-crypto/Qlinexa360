import * as cron from 'node-cron';
import prisma from '../../config/database';
import { securityLogger } from '../../utils/logger.utils';
import { syncPendingMercadoPagoPayment } from '../../payments/mercadopago/mercadopago.sync.service';
import { mercadoPagoConfig } from '../../payments/mercadopago/mercadopago.config';

/** Pagos pending más antiguos que esto se re-sincronizan con la API de MP. */
const MIN_AGE_MS = 2 * 60 * 60 * 1000;
const BATCH_LIMIT = 25;

export class MercadoPagoPendingSyncCron {
  private static job: cron.ScheduledTask | null = null;

  static start() {
    if (this.job || !mercadoPagoConfig.isConfigured()) {
      return;
    }

    this.job = cron.schedule('*/30 * * * *', () => {
      void this.run();
    });
    securityLogger.info('Cron MP pending sync programado (cada 30 minutos)');
  }

  static stop() {
    this.job?.stop();
    this.job = null;
  }

  static async runManual(limit = BATCH_LIMIT) {
    return this.run(limit);
  }

  private static async run(limit = BATCH_LIMIT) {
    const cutoff = new Date(Date.now() - MIN_AGE_MS);

    try {
      const pending = await prisma.mercadoPagoPayment.findMany({
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
          const updated = await syncPendingMercadoPagoPayment(row.id);
          if (updated && updated.status !== 'pending') {
            synced += 1;
          }
        } catch (err) {
          errors += 1;
          securityLogger.warn('MP pending sync cron: error en pago', { paymentId: row.id, err });
        }
      }

      if (synced > 0 || errors > 0) {
        securityLogger.info('MP pending sync cron finished', {
          checked: pending.length,
          synced,
          errors,
        });
      }

      return { synced, errors, checked: pending.length };
    } catch (err) {
      securityLogger.error('MP pending sync cron failed', err);
      return { synced: 0, errors: 1 };
    }
  }
}
