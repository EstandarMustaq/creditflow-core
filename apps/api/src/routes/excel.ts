import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { exportClientsTemplate, exportPortfolioWorkbook, parseLoanSheet } from '@creditflow-core/excel';
import { createClient, getPortfolioOverview } from '@creditflow-core/db';

const importSchema = z.object({
  base64: z.string().optional(),
  rows: z
    .array(
      z.object({
        name: z.string(),
        phone: z.string(),
        email: z.string().optional(),
        nationalId: z.string().optional(),
        address: z.string().optional()
      })
    )
    .optional()
});

export const excelRoutes: FastifyPluginAsync = async (app) => {
  app.post('/import', { preHandler: app.authenticate }, async (request) => {
    const input = importSchema.parse(request.body);

    const parsed = input.base64
      ? parseLoanSheet(Buffer.from(input.base64, 'base64'))
      : { rows: input.rows ?? [] };

    const created = [];
    for (const row of parsed.rows as any[]) {
      if (!row?.name || !row?.phone) {
        continue;
      }

      created.push(
        await createClient({
          name: String(row.name),
          phone: String(row.phone),
          email: row.email ? String(row.email) : undefined,
          nationalId: row.nationalId ? String(row.nationalId) : undefined,
          address: row.address ? String(row.address) : undefined
        })
      );
    }

    return {
      imported: created.length,
      rows: parsed.rows,
      created
    };
  });

  app.get('/export', { preHandler: app.authenticate }, async () => {
    const portfolio = await getPortfolioOverview();
    return {
      fileName: 'creditflow-portfolio.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      template: exportPortfolioWorkbook(portfolio)
    };
  });

  app.get('/template', async () => ({
    fileName: 'clients-template.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    template: exportClientsTemplate()
  }));
};
