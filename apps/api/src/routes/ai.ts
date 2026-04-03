import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { analyzeMicrocreditCase } from '@creditflow-core/ai-finance';
import { getLoanBalance, logAiEvent } from '@creditflow-core/db';

const analysisSchema = z.object({
  loanId: z.string().optional(),
  clientName: z.string().optional(),
  daysLate: z.number().int().nonnegative().optional(),
  outstandingBalance: z.number().nonnegative().optional(),
  installmentsLeft: z.number().int().nonnegative().optional(),
  notes: z.string().optional()
});

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.post('/analysis', { preHandler: app.authenticate }, async (request) => {
    const input = analysisSchema.parse(request.body);
    let payload: {
      loanId?: string;
      clientName: string;
      daysLate: number;
      outstandingBalance: number;
      installmentsLeft: number;
      notes?: string;
    };

    if (input.loanId) {
      const balance = await getLoanBalance(input.loanId);
      payload = {
        loanId: input.loanId,
        clientName: String((balance.client as any)?.name ?? 'Cliente'),
        daysLate: balance.summary.longestDelayDays,
        outstandingBalance: balance.summary.outstandingBalance,
        installmentsLeft: balance.summary.installmentsOpen,
        notes: input.notes
      };
    } else {
      payload = {
        loanId: undefined,
        clientName: input.clientName ?? 'Cliente',
        daysLate: input.daysLate ?? 0,
        outstandingBalance: input.outstandingBalance ?? 0,
        installmentsLeft: input.installmentsLeft ?? 0,
        notes: input.notes
      };
    }

    const analysis = await analyzeMicrocreditCase({
      clientName: payload.clientName,
      daysLate: payload.daysLate,
      outstandingBalance: payload.outstandingBalance,
      installmentsLeft: payload.installmentsLeft,
      notes: payload.notes
    });

    await logAiEvent({
      loanId: payload.loanId,
      eventType: 'LOAN_ANALYSIS',
      provider: String(analysis.provider),
      model: String(analysis.model),
      inputPayload: payload,
      outputPayload: analysis
    });

    return analysis;
  });
};
