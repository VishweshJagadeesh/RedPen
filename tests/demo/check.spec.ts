/**
 * npm run demo:check — for every scene, opens /demo#s=N&t=T&p=0 at four timestamps, saves a screenshot to
 * demo-shots/, and checks: no console errors, the caption fits (scrollWidth ≤ clientWidth), the device
 * panel shows a screen, and the overlay labels stay inside the 3D view without overlapping each other.
 */
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const OUT = "demo-shots";
const SIZES = (process.env.DEMO_SIZES ?? "1920x1080").split(",").map((s) => s.split("x").map(Number) as [number, number]);

async function scenes(page: Page) {
  await page.goto("/demo#s=1&t=0&p=0");
  await page.waitForFunction(() => window.__demo?.ready === true, null, { timeout: 120_000 });
  return page.evaluate(() => window.__demo!.scenes);
}

test("every scene renders cleanly", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const list = await scenes(page);
  const problems: string[] = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    for (let i = 0; i < list.length; i++) {
      const sc = list[i];
      const times = [0.15, 0.42, 0.7, 0.96].map((f) => Math.round(sc.dur * f * 10) / 10);
      for (const t of times) {
        const before = errors.length;
        await page.evaluate(([s, tt]) => {
          window.location.hash = `#s=${s}&t=${tt}&p=0`;
        }, [i + 1, t] as const);
        await page.waitForFunction(([s]) => window.__demo?.state.idx === s - 1, [i + 1] as const);
        // let React commit, frames load and entrance transitions settle
        await page.waitForTimeout(1300);
        const name = `${String(i + 1).padStart(2, "0")}-${sc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-t${t}${w === 1920 ? "" : `-${w}x${h}`}.png`;
        await page.screenshot({ path: `${OUT}/${name}` });
        const report = await page.evaluate(() => {
          const cap = document.getElementById("rp-caption")!;
          const labels = [...document.querySelectorAll(".rp-overlay .ol")]
            .filter((el) => (el as HTMLElement).style.display !== "none" && el.firstElementChild?.classList.contains("on"))
            .map((el) => {
              const r = (el.firstElementChild as HTMLElement).getBoundingClientRect();
              return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, text: (el.textContent ?? "").slice(0, 40) };
            });
          const world = document.querySelector(".rp-world")!.getBoundingClientRect();
          const live = document.querySelector(".dv-slot:not(.leave)");
          const frame = live?.querySelector("[data-demo-frame]") as HTMLIFrameElement | null;
          const body = frame?.contentDocument?.body ?? (live?.querySelector(".dv-card") as HTMLElement | null);
          return {
            capFits: cap.scrollWidth <= cap.clientWidth + 1,
            capText: cap.textContent ?? "",
            labels,
            world: { x0: world.left, y0: world.top, x1: world.right, y1: world.bottom },
            screen: !!body && body.innerText.trim().length > 0,
          };
        });
        if (!report.capFits) problems.push(`${name}: caption overflows`);
        if (report.capText.length > 90) problems.push(`${name}: caption longer than 90 characters`);
        if (!report.screen) problems.push(`${name}: device screen is empty`);
        const L = report.labels;
        for (let a = 0; a < L.length; a++) {
          const r = L[a];
          if (r.x0 < report.world.x0 - 1 || r.x1 > report.world.x1 + 1 || r.y0 < report.world.y0 - 1 || r.y1 > report.world.y1 + 1) problems.push(`${name}: label outside the view: ${r.text}`);
          for (let b = a + 1; b < L.length; b++) {
            const q = L[b];
            if (r.x0 < q.x1 - 1 && r.x1 > q.x0 + 1 && r.y0 < q.y1 - 1 && r.y1 > q.y0 + 1) problems.push(`${name}: labels overlap: "${r.text}" / "${q.text}"`);
          }
        }
        if (errors.length > before) problems.push(`${name}: console errors: ${errors.slice(before).join(" | ")}`);
      }
    }
  }
  if (problems.length) console.log(problems.join("\n"));
  expect(problems, problems.join("\n")).toEqual([]);
});
