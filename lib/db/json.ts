/** JSON columns are stored as strings (portable across SQLite and Postgres). */
import type { z } from "zod";

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseWith<S extends z.ZodTypeAny>(schema: S, raw: string | null | undefined, fallback: z.infer<S>): z.infer<S> {
  const value = parseJson<unknown>(raw, undefined);
  const res = schema.safeParse(value);
  return res.success ? res.data : fallback;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
