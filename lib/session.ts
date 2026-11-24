/** A deliberately simple demo session: one cookie holding the seeded teacher's id. */
import { cookies } from "next/headers";
import { TEACHER } from "./fixtures/school";

export const SESSION_COOKIE = "redpen_session";

export async function currentTeacherId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function requireTeacherId(): Promise<string> {
  const id = await currentTeacherId();
  if (!id) throw new Error("Not signed in");
  return id;
}

export const DEMO_TEACHER_ID = TEACHER.id;
