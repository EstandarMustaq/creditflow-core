import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queueAndSendReminders } from '@creditflow-core/db';

const reminderSchema = z.object({
  referenceDate: z.string().optional(),
  overdueThresholdDays: z.number().int().positive().default(3),
  dryRun: z.boolean().default(false)
});

export const reminderRoutes: FastifyPluginAsync = async (app) => {
  app.post('/send', { preHandler: app.authenticate }, async (request) => {
    const input = reminderSchema.parse(request.body ?? {});
    return queueAndSendReminders(input);
  });
};
