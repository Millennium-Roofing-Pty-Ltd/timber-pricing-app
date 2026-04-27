import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

// Load .env values when present so VS Code runs work without manual exports.
(process as any).loadEnvFile?.(existsSync(envPath) ? envPath : undefined);

process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
process.env.PORT = process.env.PORT ?? "5000";

await import("../server/index.ts");
