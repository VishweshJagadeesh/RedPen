import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { saveRemedialDraft, type RemedialQuestion } from "@/lib/remedial/service";

/** "Save draft & leave": optional unsaved questions, then mark the draft as kept. */
export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = z.object({ questions: z.array(z.object({ id: z.string(), text: z.string() }).passthrough()).optional() }).parse(await req.json().catch(() => ({})));
  await saveRemedialDraft(id, body.questions as unknown as RemedialQuestion[] | undefined);
  return { ok: true };
});
