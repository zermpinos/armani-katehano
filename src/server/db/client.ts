import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../lib/generated/prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

const pool = new Pool({
  connectionString:      process.env.DATABASE_URL,
  // Serverless-safe limits: each function instance is short-lived, so 2
  // connections per instance is ample while staying well under Neon's 100-conn
  // free-tier cap even with many concurrent invocations.
  max:                   2,
  idleTimeoutMillis:     10_000,
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
