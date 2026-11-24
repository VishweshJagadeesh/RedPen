import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { addFlagHistory } from "@/lib/services/followups";

const Body = z.object({
  status: z.enum(["open", "action_taken", "improving", "resolved"]),
  note: z.string().max(500).optional(),
});

/** Teacher updates an alert's status (with a note kept in its history). */
export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const defaults = { open: "Reopened by the teacher.", action_taken: "Action taken by the teacher.", improving: "Marked as improving by the teacher.", resolved: "Resolved by the teacher." };
  await addFlagHistory(id, body.status, body.note?.trim() || defaults[body.status]);
  return { ok: true };
});
