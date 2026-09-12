import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function normalizeDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const sslmode = parsed.searchParams.get("sslmode");
    // If sslmode is require/prefer/verify-ca and uselibpqcompat is not set,
    // explicitly set uselibpqcompat=true to eliminate the pg/pg-connection-string v9 deprecation warning
    if (
      sslmode &&
      ["require", "prefer", "verify-ca"].includes(sslmode.toLowerCase()) &&
      !parsed.searchParams.has("uselibpqcompat")
    ) {
      parsed.searchParams.set("uselibpqcompat", "true");
      return parsed.toString();
    }
  } catch {
    // If connection string is non-standard URL, fallback to raw string
  }
  return url;
}

const rawDatabaseUrl = process.env.DATABASE_URL;
const databaseUrl = normalizeDatabaseUrl((rawDatabaseUrl ?? "").trim());
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

export const prismaClientOptions = { adapter };

export function createPrismaClient() {
  return new PrismaClient(prismaClientOptions);
}
