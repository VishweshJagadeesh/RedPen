import { NextResponse } from "next/server";
import { buildDemoData } from "@/src/demo/data/build";

// Built once at build time from the seed fixtures (no database).
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildDemoData());
}
