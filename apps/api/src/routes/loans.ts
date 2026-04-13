import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { calculateLoanSchedule } from '@creditflow-core/finance-engine';
import { createLoanContract, generateSettlementLetter, getLoanBalance, regenerateLoanSchedule } from '@creditflow-core/db';
import { isMozNationalId, isMozMobilePhone, isNuib } from '@creditflow-core/shared';

const simulateSchema = z.object({
  principal: z.number().positive(),
  annualInterestRate: z.number().min(0),
  installmentCount: z.number().int().positive(),
  startDate: z.string(),
  graceDays: z.number().int().nonnegative().default(0),
  lateFeeRateDaily: z.number().min(0).default(0),
  currency: z.string().min(3).max(5).default('MZN')
});

const createLoanSchema = simulateSchema.extend({
  clientId: z.string().min(1),
  imfId: z.string().min(1).optional(),
  counterparties: z
    .array(
      z.object({
        role: z.enum(['AVALIST', 'GUARANTOR']),
        name: z.string().min(2),
        nuib: z.string().refine(isNuib, 'NUIB must have exactly 15 digits'),
        nationalId: z.string().refine(isMozNationalId, 'Invalid Mozambique national ID').optional(),
        phone: z.string().refine(isMozMobilePhone, 'Invalid Mozambique mobile number').optional(),
      }),
    )
    .default([])
});

const regenerateSchema = z.object({
  annualInterestRate: z.number().min(0),
  installmentCount: z.number().int().positive(),
  startDate: z.string(),
  graceDays: z.number().int().nonnegative().optional(),
  lateFeeRateDaily: z.number().min(0).optional(),
  reason: z.string().min(3).optional()
});

export const loanRoutes: FastifyPluginAsync = async (app) => {
  app.post('/simulate', { preHandler: app.authenticate }, async (request) => {
    const input = simulateSchema.parse(request.body);
    return calculateLoanSchedule(input);
  });

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const input = createLoanSchema.parse(request.body);
    const loan = await createLoanContract(input);
    return reply.code(201).send(loan);
  });

  app.post('/:id/schedule', { preHandler: app.authenticate }, async (request: any) => {
    const input = regenerateSchema.parse(request.body);
    return regenerateLoanSchedule({
      loanId: request.params.id,
      ...input
    });
  });

  app.get('/:id/balance', { preHandler: app.authenticate }, async (request: any) => {
    return getLoanBalance(request.params.id);
  });

  app.get('/:id/settlement-letter', { preHandler: app.authenticate }, async (request: any) => {
    return generateSettlementLetter({
      loanId: request.params.id,
      issuedBy: request.user?.name ?? request.user?.sub ?? null,
    });
  });
};
