import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import jwt from '@fastify/jwt';

import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { loanRoutes } from './routes/loans.js';
import { paymentRoutes } from './routes/payments.js';
import { aiRoutes } from './routes/ai.js';
import { excelRoutes } from './routes/excel.js';
import { calendarRoutes } from './routes/calendar.js';
import { reportRoutes } from './routes/reports.js';
import { reminderRoutes } from './routes/reminders.js';

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret' });

  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.unauthorized('Token inválido ou ausente');
    }
  });

  app.get('/', async () => ({
    service: 'creditflow-core',
    status: 'ok',
    modules: ['auth', 'clients', 'loans', 'payments', 'ai', 'excel', 'calendar', 'reminders', 'reports']
  }));

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(clientRoutes, { prefix: '/clients' });
  await app.register(loanRoutes, { prefix: '/loans' });
  await app.register(paymentRoutes, { prefix: '/payments' });
  await app.register(aiRoutes, { prefix: '/ai' });
  await app.register(excelRoutes, { prefix: '/excel' });
  await app.register(calendarRoutes, { prefix: '/calendar' });
  await app.register(reminderRoutes, { prefix: '/reminders' });
  await app.register(reportRoutes, { prefix: '/reports' });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
