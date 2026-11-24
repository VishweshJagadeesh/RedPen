import { expect, test } from "@playwright/test";
import { clickUntil, id, signInFresh, waitForGrading } from "./helpers";

test("flow 3: flag → remedial sheet → regrade → flag improving", async ({ page }) => {
  await signInFresh(page);
  await clickUntil(page, id("nav-alerts"), id("flagged-students-list"));
  await clickUntil(page, id("flag-row-rohan-kumar"), id("why-flagged-panel"));
  await expect(page.locator(id("flag-summary"))).toContainText("76% fell to 41%");
  await expect(page.locator(id("flag-summary"))).toContainText("2 questions unattempted");
  await expect(page.locator(id("flag-rules"))).toContainText("20 points");
  await expect(page.locator(id("flag-suggested-action"))).toContainText("Rohan");

  await clickUntil(page, id("create-remedial-from-flag"), id("remedial-builder"));
  await expect(page.locator('[data-demo-id="remedial-concept-c8-le-transposing"]')).toHaveAttribute("data-state", "checked");
  await clickUntil(page, id("generate-remedial"), id("remedial-question-5"));
  await expect(page.locator(id("remedial-question-5"))).toBeVisible();
  await expect(page.locator(id("targets-mistake-1"))).toContainText("you moved a term across the equals sign without changing its sign");
  await expect(page.locator(id("print-remedial"))).toBeVisible();
  await clickUntil(page, id("assign-remedial"), id("upload-remedial-submissions"));

  await clickUntil(page, id("upload-remedial-submissions"), id("upload-wizard"));
  await clickUntil(page, id("use-sample-sheets"), id("match-summary"));
  await page.click(id("confirm-matches"));
  await expect(page.locator(id("confirm-matches"))).toHaveText(/Start grading/);
  await page.click(id("confirm-matches"));
  await waitForGrading(page);
  await clickUntil(page, id("go-to-review"), id("review-queue"));
  await page.click(id("filter-all"));
  for (let i = 0; i < 5; i++) await page.keyboard.press("a");
  await expect(page.locator(id("reviewed-count"))).toContainText("5 of 5");
  await page.click(id("finalise-assessment"));
  await expect(page.locator(id("finalise-notes"))).toContainText("Improving (8/10 (80%)");

  await page.goto("/alerts/flag_8b_36");
  await expect(page.locator(id("flag-status"))).toHaveText("Improving");
  await expect(page.locator(id("flag-history"))).toContainText("up from 20% in PT1");
});
