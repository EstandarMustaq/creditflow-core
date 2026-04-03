import type { FastifyPluginAsync } from 'fastify';
import { buildLoanCalendar } from '@creditflow-core/calendar';

export const calendarRoutes: FastifyPluginAsync = async (app) => {
  app.post('/build', { preHandler: app.authenticate }, async (request: any) => {
    const schedule = request.body?.schedule ?? [];
    return buildLoanCalendar(schedule);
  });
};
