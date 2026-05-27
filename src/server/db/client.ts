import "@/server/_internal/node-only";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon }       from "@prisma/adapter-neon";
import { PrismaClient }     from "../../../lib/generated/prisma/client";
import ws                   from "ws";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
