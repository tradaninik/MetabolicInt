import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  libsql?: ReturnType<typeof createClient>;
};

// One shared libSQL client: Turso (libsql://) in production via env vars,
// local SQLite (file:…) in development. Same client handles both.
const libsql =
  globalForPrisma.libsql ??
  createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.libsql = libsql;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSQL(libsql),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;