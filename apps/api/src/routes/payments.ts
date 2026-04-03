import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { recordPayment } from '@creditflow-core/db';

const paymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.number().positive(),
  paidAt: z.string().optional(),
  reference: z.string().optional()
});

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', { preHandler: app.authenticate }, async (request) => {
    const input = paymentSchema.parse(request.body);
    return recordPayment(input);
  });
};
