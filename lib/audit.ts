import { prisma } from "./db/prisma";

export type AuditActor = "teacher" | "ai" | "system";

export async function audit(actor: AuditActor, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await prisma.auditLog.create({
    data: { actor, action, entityType, entityId, details: JSON.stringify(details) },
  });
}
