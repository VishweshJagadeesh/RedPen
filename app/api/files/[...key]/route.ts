import { storage } from "@/lib/storage";
import { isSyntheticKey } from "@/lib/fixtures/synthetic";
import { syntheticPage } from "@/lib/services/synthetic-pages";
import type { RouteCtx } from "@/lib/api";

/** Serves files from the local storage adapter and generated practice sheets. (Blob keys are public URLs and never hit this.) */
export async function GET(_req: Request, ctx: RouteCtx<{ key: string[] }>) {
  const { key } = await ctx.params;
  const path = key.map(decodeURIComponent).join("/");
  if (path.includes("..")) return new Response("Bad path", { status: 400 });
  const file = isSyntheticKey(path) ? await syntheticPage(path) : await storage().get(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=3600", ...(isSyntheticKey(path) ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src data:" } : {}) },
  });
}
