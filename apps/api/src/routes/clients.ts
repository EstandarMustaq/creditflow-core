import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createClient, getClientStatement, listClients } from '@creditflow-core/db';
import { isGoogleEmail, isMozMobilePhone, isMozNationalId, isNuib, normalizeAddress } from '@creditflow-core/shared';

const clientSchema = z.object({
  name: z.string().min(2),
  nuib: z.string().refine(isNuib, 'NUIB must have exactly 15 digits'),
  phone: z.string().refine(isMozMobilePhone, 'Use a valid Mozambique mobile number'),
  email: z.string().email().refine(isGoogleEmail, 'Client email must be a Google account'),
  nationalId: z.string().refine(isMozNationalId, 'Mozambique national ID must start with 100 and end with an uppercase letter'),
  address: z.string().min(5).transform(normalizeAddress),
  crcConsentAt: z.string().optional(),
});

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async () => {
    const items = await listClients();
    return { items };
  });

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const input = clientSchema.parse(request.body);
    const client = await createClient(input);
    return reply.code(201).send(client);
  });

  app.get('/:id/statement', { preHandler: app.authenticate }, async (request: any) => {
    return getClientStatement(request.params.id);
  });
};
