import { handle, type RouteCtx } from "@/lib/api";
import { addPage, storeUpload } from "@/lib/services/assessments";

export const maxDuration = 60;

/** Upload one answer-sheet page (sent in capture order). */
export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file received.");
  if (!file.type.startsWith("image/")) throw new Error("Answer sheets must be photos (JPG, PNG or WebP).");
  const key = await storeUpload(`sheets/${id}`, file);
  return addPage(id, key);
});
