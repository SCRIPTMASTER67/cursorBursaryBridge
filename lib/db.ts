import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './database-url';

/**
 * A single PrismaClient is reused across hot reloads in development, otherwise
 * every reload would open a new connection pool and exhaust PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    // Passed explicitly rather than left to the schema's env("DATABASE_URL"),
    // because on a managed platform the connection often arrives under another
    // name entirely. See lib/database-url.ts.
    datasourceUrl: resolveDatabaseUrl(),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
