import { storage } from "@/lib/storage";
import type { RouteCtx } from "@/lib/api";

/** Serves files from the local storage adapter. (Blob keys are public URLs and never hit this.) */
export async function GET(_req: Request, ctx: RouteCtx<{ key: string[] }>) {
  const { key } = await ctx.params;
  const path = key.map(decodeURIComponent).join("/");
  if (path.includes("..")) return new Response("Bad path", { status: 400 });
  const file = await storage().get(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=3600" } });
}
