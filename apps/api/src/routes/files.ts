import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { exportClientsTemplateCsv, parseDelimitedFile } from '@creditflow-core/file-exchange';
import { createClient } from '@creditflow-core/db';
import { isGoogleEmail, isMozMobilePhone, isMozNationalId, isNuib, normalizeAddress } from '@creditflow-core/shared';

const importSchema = z.object({
  base64: z.string().optional(),
  rows: z
    .array(
      z.object({
        name: z.string(),
        nuib: z.string().refine(isNuib, 'NUIB must have exactly 15 digits'),
        phone: z.string().refine(isMozMobilePhone, 'Use a valid Mozambique mobile number'),
        email: z.string().email().refine(isGoogleEmail, 'Client email must be a Google account'),
        nationalId: z.string().refine(isMozNationalId, 'Invalid Mozambique national ID'),
        address: z.string().min(5).transform(normalizeAddress),
        crcConsentAt: z.string().optional(),
      }),
    )
    .optional(),
});

export const fileRoutes: FastifyPluginAsync = async (app) => {
  app.post('/import', { preHandler: app.authenticate }, async (request) => {
    const input = importSchema.parse(request.body);

    const parsed = input.base64
      ? parseDelimitedFile(Buffer.from(input.base64, 'base64'))
      : { rows: input.rows ?? [] };

    const created = [];
    for (const row of parsed.rows as any[]) {
      if (!row?.name || !row?.nuib || !row?.phone || !row?.email || !row?.nationalId || !row?.address) {
        continue;
      }

      created.push(
        await createClient({
          name: String(row.name),
          nuib: String(row.nuib),
          phone: String(row.phone),
          email: String(row.email),
          nationalId: String(row.nationalId),
          address: String(row.address),
          crcConsentAt: row.crcConsentAt ? String(row.crcConsentAt) : undefined,
        }),
      );
    }

    return {
      imported: created.length,
      rows: parsed.rows,
      created,
    };
  });

  app.get('/template', async () => ({
    fileName: 'clients-template.csv',
    mimeType: 'text/csv; charset=utf-8',
    template: exportClientsTemplateCsv(),
  }));
};
