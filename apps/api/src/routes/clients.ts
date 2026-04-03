import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createClient, getClientStatement, listClients } from '@creditflow-core/db';

const clientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  nationalId: z.string().min(3).optional(),
  address: z.string().optional()
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
