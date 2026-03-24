// lib/prisma.js
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import { Pool } from "pg";

const globalForPrisma = globalThis;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma; // ← the missing default export that breaks all 16 files

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // pooled -- used at runtime
  directUrl = env("DIRECT_URL")         // direct -- used for migrations & introspection
}