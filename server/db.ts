import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/timber_pricing_app";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL is not set. Using local default postgres URL for development.",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool, schema });
