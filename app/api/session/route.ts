import { NextResponse } from "next/server";
import { DEMO_TEACHER_ID, SESSION_COOKIE } from "@/lib/session";

/** "Continue as demo teacher": sets a simple session cookie for the seeded teacher. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/dashboard");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const res = NextResponse.redirect(new URL(safeNext, req.url), 303);
  res.cookies.set(SESSION_COOKIE, DEMO_TEACHER_ID, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  void req;
  return res;
}
