/**
 * npm run demo:record — records the full walkthrough at 1920×1080 to demo.webm (a backup for live demos).
 *
 * Default: Playwright's video of the demo playing in real time. That needs a machine that renders the 3D scene
 * at full speed; on a slow one (software WebGL, CI) the demo itself slows down and the video runs long.
 *
 * DEMO_RECORD_MODE=frames: frame by frame instead. The demo stops following the wall clock, each frame moves it
 * by exactly 1/30 s, CSS animations are slowed to the same pace, and every frame is screenshotted and piped
 * into ffmpeg (needs `ffmpeg` with libvpx-vp9 on PATH). Smooth 30 fps on any machine; takes longer than real time.
 */
import { spawn } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const MODE = process.env.DEMO_RECORD_MODE ?? "realtime";
const FPS = 30;

test.use({
  viewport: { width: 1920, height: 1080 },
  video: MODE === "realtime" ? { mode: "on", size: { width: 1920, height: 1080 } } : "off",
});

async function open(page: Page) {
  await page.goto("/demo#s=1&t=0&p=0");
  await page.waitForFunction(() => window.__demo?.ready === true, null, { timeout: 120_000 });
  await page.keyboard.press("h"); // hide the controls for the recording
  return page.evaluate(() => window.__demo!.totalSeconds);
}

test.describe("realtime", () => {
  test.skip(MODE !== "realtime");
  test("record the walkthrough", async ({ page }) => {
    test.setTimeout(60 * 60_000);
    const total = await open(page);
    await page.evaluate(() => {
      window.__demo!.go(0);
      window.__demo!.play();
    });
    const started = Date.now();
    // wait for the end rather than a fixed time, so a slow machine still records all of it
    await page.waitForFunction(() => window.__demo?.ended === true, null, { timeout: 55 * 60_000, polling: 500 });
    await page.waitForTimeout(1500);
    const took = (Date.now() - started) / 1000;
    if (took > total * 1.2)
      console.warn(`The demo took ${took.toFixed(0)}s to play ${total}s: this machine renders slowly. Try DEMO_RECORD_MODE=frames.`);
    await page.close();
    await page.video()?.saveAs("demo.webm");
  });
});

test.describe("frames", () => {
  test.skip(MODE !== "frames");
  test("record the walkthrough frame by frame", async ({ page }) => {
    test.setTimeout(4 * 60 * 60_000);
    const total = await open(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Animation.enable");
    await page.evaluate(() => {
      window.__demo!.manual(true);
      window.__demo!.go(0);
      window.__demo!.play();
    });

    const ffmpeg = spawn(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "5",
        "-pix_fmt", "yuv420p", "demo.webm"],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    const done = new Promise<number>((resolve) => ffmpeg.on("close", (code) => resolve(code ?? 1)));

    // DEMO_RECORD_SECONDS=10 records only the first seconds (a quick smoke test)
    const limit = Number(process.env.DEMO_RECORD_SECONDS ?? 0) || total + 30;
    const frames = Math.ceil(limit * FPS);
    let endedAt = -1;
    let rate = 0.1;
    let windowStart = Date.now();
    for (let f = 0; f < frames; f++) {
      // CSS transitions and animations run on the wall clock: slow them to the pace frames are captured at
      if (f % 15 === 0) {
        if (f > 0) rate = Math.min(1, Math.max(0.005, 15 / FPS / ((Date.now() - windowStart) / 1000)));
        windowStart = Date.now();
        await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
      }
      const ended = await page.evaluate(
        (dt) =>
          new Promise<boolean>((resolve) => {
            window.__demo!.advance(dt);
            // two animation frames: React commits store changes and the iframes repaint
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.__demo!.ended)));
          }),
        1 / FPS,
      );
      const jpg = await page.screenshot({ type: "jpeg", quality: 90 });
      if (!ffmpeg.stdin.write(jpg)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
      if (ended && endedAt < 0) endedAt = f;
      if (endedAt >= 0 && f - endedAt >= 1.5 * FPS) break; // hold the last frame for 1.5 s
      if (f % (FPS * 10) === 0) console.log(`frame ${f} / ${frames}`);
    }
    ffmpeg.stdin.end();
    expect(await done).toBe(0);
  });
});
