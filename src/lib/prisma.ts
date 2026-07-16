import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  // Keep each instance's pool small: on serverless (Vercel) many instances share
  // the Supabase pooler, so a large per-instance pool exhausts connections.
  // Use the Supabase **Transaction pooler (:6543)** in DATABASE_URL for prod.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
