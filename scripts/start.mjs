import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

process.loadEnvFile?.(existsSync(envPath) ? envPath : undefined);

process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

await import("../dist/index.js");
