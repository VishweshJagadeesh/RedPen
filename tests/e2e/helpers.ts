import { expect, type Page } from "@playwright/test";

/** One click in, then restore the exact seeded state so every flow starts from the same data. */
export async function signInFresh(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as demo teacher" }).click();
  await page.waitForURL("**/dashboard");
  const res = await page.request.post("/api/settings/reset");
  expect(res.ok()).toBeTruthy();
  await page.goto("/dashboard");
}

export const id = (demoId: string) => `[data-demo-id="${demoId}"]`;

/** Grades every waiting sheet via the progress screen and waits for completion. */
export async function waitForGrading(page: Page) {
  await expect(page.getByText("Grading complete")).toBeVisible({ timeout: 90_000 });
}

/** Clicks until `until` appears — guards against clicking a server-rendered button before hydration. */
export async function clickUntil(page: Page, selector: string, until: string, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    await page.click(selector);
    try {
      await page.waitForSelector(until, { timeout: 4000 });
      return;
    } catch {
      // not hydrated yet — try again
    }
  }
  await page.waitForSelector(until, { timeout: 10000 });
}
