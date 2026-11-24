import { handle } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { resetDemoData } from "@/lib/seed";

export const maxDuration = 120;

/** "Reset demo data": restores the exact seeded state (same as npm run db:seed). */
export const POST = handle(async () => {
  const result = await resetDemoData(prisma);
  return { ok: true, ...result };
});
