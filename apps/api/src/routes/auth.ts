import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashPassword, signAccessToken, verifyPassword } from '@creditflow-core/auth';
import { prisma } from '@creditflow-core/db';
import {
  getAllowedCorporateEmail,
  isAllowedCorporateUserEmail,
  isKnownCorporateUserEmail,
  normalizeEmail,
} from '@creditflow-core/shared';

const registerSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['ADMIN', 'MANAGER', 'OFFICER']).default('OFFICER')
  })
  .superRefine((input, ctx) => {
    if (!isAllowedCorporateUserEmail(input.email, input.role)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: `Email must match the role domain ${getAllowedCorporateEmail(input.role)}`
      });
    }
  });

const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8)
  })
  .superRefine((input, ctx) => {
    if (!isKnownCorporateUserEmail(input.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Email must use a corporate CoreBank domain'
      });
    }
  });

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: normalizeEmail(input.email),
        passwordHash,
        role: input.role,
        lastActiveAt: new Date(),
        roleDef: {
          connect: { code: input.role }
        }
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

  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      },
      handler: async (request, reply) => {
        const input = loginSchema.parse(request.body);
        const user = await prisma.user.findUnique({
          where: { email: normalizeEmail(input.email) }
        });

        if (!user) {
          return reply.unauthorized('Credenciais inválidas');
        }

        const valid = await verifyPassword(input.password, String(user.passwordHash));
        if (!valid) {
          return reply.unauthorized('Credenciais inválidas');
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastActiveAt: new Date(),
          },
        });

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
      }
    }
  );
};
