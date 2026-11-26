/**
 * Playwright config for the walkthrough: `npm run demo:check` (screenshots + checks per scene) and
 * `npm run demo:record` (full-run video). Set DEMO_BASE_URL to use a server that is already running.
 */
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.DEMO_PORT ?? 3200);
const external = process.env.DEMO_BASE_URL;

export default defineConfig({
  testDir: "tests/demo",
  timeout: 15 * 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    trace: "off",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  webServer: external
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: `http://localhost:${PORT}/demo/data.json`,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { AI_MODE: "mock" },
      },
});
