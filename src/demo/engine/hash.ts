/**
 * Deep links for rehearsal and testing: `#s=5&t=7.5&p=0`
 *   s — scene number, 1-based
 *   t — seconds into the scene (after its pre-roll)
 *   p — 0 to start paused (anything else, or absent, plays)
 */
export interface DeepLink {
  scene: number; // 0-based index
  time: number | null;
  paused: boolean;
}

export function parseDeepLink(hash: string, sceneCount: number): DeepLink {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const s = Number(q.get("s"));
  const scene = Number.isFinite(s) && s >= 1 ? Math.min(sceneCount, Math.floor(s)) - 1 : 0;
  const tRaw = q.get("t");
  const t = tRaw === null ? NaN : Number(tRaw);
  return { scene: Math.max(0, scene), time: Number.isFinite(t) && t >= 0 ? t : null, paused: q.get("p") === "0" };
}

export function formatDeepLink(link: DeepLink): string {
  const parts = [`s=${link.scene + 1}`];
  if (link.time !== null) parts.push(`t=${Math.round(link.time * 100) / 100}`);
  if (link.paused) parts.push("p=0");
  return `#${parts.join("&")}`;
}
