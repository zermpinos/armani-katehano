import "@/server/_internal/node-only";
import { neonConfig }   from "@neondatabase/serverless";
import { PrismaNeon }   from "@prisma/adapter-neon";
import { PrismaClient } from "../../../lib/generated/prisma/client";
import ws               from "ws";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
