import type { RouteCtx } from "@/lib/api";
import { getResults, resultsCsv } from "@/lib/queries/review";

export async function GET(_req: Request, ctx: RouteCtx<{ id: string }>) {
  const { id } = await ctx.params;
  const r = await getResults(id);
  if (!r) return new Response("Not found", { status: 404 });
  const filename = `${r.assessment.section}-${r.assessment.title}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(resultsCsv(r), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` },
  });
}
