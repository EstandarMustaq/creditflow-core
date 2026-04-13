import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  assertCrcExportAccess,
  assertCrcReadAccess,
  exportCrcPortfolio,
  listCrcConsultations,
  listCrcExportLayouts,
  listCrcRectificationCases,
  logCrcConsultation,
  openCrcRectificationCase,
  upsertCrcExportLayout,
} from '@creditflow-core/db';

const consultationSchema = z.object({
  clientId: z.string().min(1),
  responseRef: z.string().optional(),
  charged: z.boolean().default(true),
  queryCount: z.number().int().positive().default(1),
});

const rectificationSchema = z.object({
  clientId: z.string().min(1),
  loanContractId: z.string().optional(),
  reason: z.string().min(5),
  requestedByClientAt: z.string().optional(),
  institutionDetectedAt: z.string().optional(),
});

const layoutSchema = z.object({
  name: z.string().min(2),
  format: z.enum(['CSV', 'XML']),
  fields: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })).min(1),
  rootNode: z.string().optional(),
  active: z.boolean().default(true),
});

const exportSchema = z.object({
  format: z.enum(['CSV', 'XML']).default('CSV'),
  layoutName: z.string().default('default_csv'),
  imfId: z.string().optional(),
});

export const crcRoutes: FastifyPluginAsync = async (app) => {
  app.get('/layouts', { preHandler: app.authenticate }, async (request: any) => {
    assertCrcReadAccess(String(request.user?.role ?? ''));
    return listCrcExportLayouts();
  });

  app.post('/layouts', { preHandler: app.authenticate }, async (request: any, reply) => {
    assertCrcExportAccess(String(request.user?.role ?? ''));
    const input = layoutSchema.parse(request.body);
    const layout = await upsertCrcExportLayout(input);
    return reply.code(201).send(layout);
  });

  app.get('/export', { preHandler: app.authenticate }, async (request: any) => {
    assertCrcExportAccess(String(request.user?.role ?? ''));
    const input = exportSchema.parse(request.query ?? {});
    return exportCrcPortfolio({
      ...input,
      performedBy: request.user?.name ?? request.user?.sub ?? null,
    });
  });

  app.get('/rectifications', { preHandler: app.authenticate }, async (request: any) => {
    assertCrcReadAccess(String(request.user?.role ?? ''));
    return listCrcRectificationCases();
  });

  app.post('/rectifications', { preHandler: app.authenticate }, async (request: any, reply) => {
    assertCrcReadAccess(String(request.user?.role ?? ''));
    const input = rectificationSchema.parse(request.body);
    const result = await openCrcRectificationCase(input);
    return reply.code(201).send(result);
  });

  app.get('/consultations', { preHandler: app.authenticate }, async (request: any) => {
    assertCrcReadAccess(String(request.user?.role ?? ''));
    return listCrcConsultations();
  });

  app.post('/consultations', { preHandler: app.authenticate }, async (request: any, reply) => {
    assertCrcReadAccess(String(request.user?.role ?? ''));
    const input = consultationSchema.parse(request.body);
    const result = await logCrcConsultation({
      ...input,
      performedBy: request.user?.name ?? request.user?.sub ?? null,
    });
    return reply.code(201).send(result);
  });
};
