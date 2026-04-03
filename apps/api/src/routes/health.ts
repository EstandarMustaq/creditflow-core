import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
};
