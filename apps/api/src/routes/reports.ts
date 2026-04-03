import type { FastifyPluginAsync } from 'fastify';
import { getPortfolioOverview } from '@creditflow-core/db';

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/portfolio', { preHandler: app.authenticate }, async () => getPortfolioOverview());
};
