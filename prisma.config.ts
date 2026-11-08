import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  // Only the CLI reads this, and Prisma 7 has no directUrl. The app connects
  // through DATABASE_URL in src/server/db/client.ts.
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
