import { prisma } from "../db/prisma";
import { aiMode, gradingModel, planningModel } from "../ai/mode";
import { config } from "../config";
import { storage } from "../storage";

export async function getSettings() {
  const audit = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 });
  const counts = {
    overrides: await prisma.auditLog.count({ where: { action: "grade.override" } }),
    aiActions: await prisma.auditLog.count({ where: { actor: "ai" } }),
  };
  return {
    mode: aiMode(),
    models: { grading: gradingModel(), planning: planningModel() },
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    storage: storage().name,
    database: (process.env.DATABASE_URL ?? "").startsWith("postgres") ? "Postgres" : "SQLite",
    thresholds: config,
    counts,
    audit: audit.map((a) => ({ id: a.id, actor: a.actor, action: a.action, entityType: a.entityType, entityId: a.entityId, details: a.details, createdAt: a.createdAt.toISOString() })),
  };
}
export type SettingsData = Awaited<ReturnType<typeof getSettings>>;
