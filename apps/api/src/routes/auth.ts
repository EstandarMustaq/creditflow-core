import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashPassword, signAccessToken, verifyPassword } from '@creditflow-core/auth';
import { prisma } from '@creditflow-core/db';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'MANAGER', 'OFFICER']).default('OFFICER')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const user = await (prisma as any).user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role
      }
    });

    const token = signAccessToken({
      sub: String(user.id),
      role: input.role,
      name: input.name
    });

    return reply.code(201).send({
      authenticated: true,
      user: {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        role: String(user.role)
      },
      token
    });
  });

  app.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await (prisma as any).user.findUnique({
      where: { email: input.email }
    });

    if (!user) {
      return reply.unauthorized('Credenciais inválidas');
    }

    const valid = await verifyPassword(input.password, String(user.passwordHash));
    if (!valid) {
      return reply.unauthorized('Credenciais inválidas');
    }

    return {
      authenticated: true,
      token: signAccessToken({
        sub: String(user.id),
        role: String(user.role) as 'ADMIN' | 'MANAGER' | 'OFFICER',
        name: String(user.name)
      }),
      user: {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        role: String(user.role)
      }
    };
  });
};
