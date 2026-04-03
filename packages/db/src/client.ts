import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const currentDir = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(currentDir, '../../../.env'), override: false });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Create a .env file from .env.example and define a valid PostgreSQL connection string before starting the API or worker.',
  );
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['warn', 'error']
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
