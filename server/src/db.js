import { PrismaClient } from '@prisma/client'

// Locally DATABASE_URL points at SQLite (file:./data/pmsetu.db, see
// .env.example). On Render it is the Postgres connection string injected
// from the blueprint; the Prisma client is generated against
// prisma/schema.postgres.prisma there (see scripts/postgres-schema.cjs).
const globalForPrisma = globalThis
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error', 'warn'],
})
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
