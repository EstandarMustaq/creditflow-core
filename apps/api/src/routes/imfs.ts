import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { listImfs, registerImf } from '@creditflow-core/db';
import { isNuib } from '@creditflow-core/shared';

const imfSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  nuib: z.string().refine(isNuib, 'IMF NUIB must have exactly 15 digits'),
  email: z.string().email().optional(),
});

export const imfRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async () => listImfs());

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const input = imfSchema.parse(request.body);
    const imf = await registerImf(input);
    return reply.code(201).send(imf);
  });
};
