import type { FastifyPluginAsync } from 'fastify';
import { getWorkerHealth } from '@creditflow-core/shared';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    const worker = await getWorkerHealth();

    return {
      ok: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      api: {
        active: true,
        state: 'online'
      },
      worker
    };
  });
};
