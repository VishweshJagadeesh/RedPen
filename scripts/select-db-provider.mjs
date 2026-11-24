// Switches the Prisma datasource provider based on DATABASE_URL.
// SQLite ("file:...") for local development, Postgres ("postgres://..." / "postgresql://...") in production.
import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
if (!fs.existsSync(schemaPath)) process.exit(0);

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const provider = /^postgres(ql)?:\/\//.test(url) ? "postgresql" : "sqlite";
const schema = fs.readFileSync(schemaPath, "utf8");
const next = schema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`);
if (next !== schema) {
  fs.writeFileSync(schemaPath, next);
  console.log(`[db] Prisma provider set to ${provider}`);
}
