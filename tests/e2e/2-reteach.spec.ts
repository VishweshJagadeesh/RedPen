import { expect, test } from "@playwright/test";
import { clickUntil, id, signInFresh, waitForGrading } from "./helpers";

test("flow 2: weak concept → reteach plan → exit ticket → mastery before/after", async ({ page }) => {
  await signInFresh(page);
  await clickUntil(page, id("nav-section-8B"), id("class-dashboard"));
  const card = page.locator(id("weak-concept-card-c8-le-transposing"));
  await expect(card.locator(id("weak-concept-affected"))).toContainText("33 of 52");
  await expect(card.locator(id("weak-concept-misconceptions"))).toContainText("21");
  await expect(card).toContainText("Class mastery 36%");

  await clickUntil(page, `${id("weak-concept-card-c8-le-transposing")} ${id("plan-reteach")}`, id("generate-plan"));
  await page.selectOption(id("reteach-resources"), "blackboard");
  await clickUntil(page, id("generate-plan"), id("reteach-plan-editor"));
  await expect(page.locator(id("reteach-plan-editor"))).toBeVisible();
  await expect(page.locator(id("cites-explanation"))).toContainText('without changing its sign');
  await expect(page.locator(id("cites-misconception"))).toContainText("one side only");
  await expect(page.locator(id("plan-time-budget"))).toContainText("40 / 40");
  await expect(page.locator(id("plan-section-exit_ticket"))).toContainText("Q4.");

  // Edit a section inline, regenerate another, then teach.
  await page.click(id("edit-section-objective"));
  await page.fill(id("section-body-objective"), "Students move terms across = and change the sign, and check by substitution.");
  await page.click(id("edit-section-objective"));
  await page.click(id("save-plan"));
  await expect(page.getByText("All changes saved")).toBeVisible();
  const hookBefore = await page.locator(id("plan-section-hook")).innerText();
  await page.click(id("regenerate-hook"));
  await expect.poll(async () => page.locator(id("plan-section-hook")).innerText()).not.toBe(hookBefore);

  await clickUntil(page, id("open-teaching-mode"), id("teaching-mode"));
  await expect(page.locator(id("teaching-step-title"))).toContainText("Prerequisite");
  await page.click(id("next-step"));
  await expect(page.locator(id("teaching-step-title"))).toContainText("Hook");
  await clickUntil(page, id("exit-teaching-mode"), id("reteach-plan-editor"));

  await clickUntil(page, id("mark-plan-taught"), id("create-exit-ticket"));
  await clickUntil(page, id("create-exit-ticket"), id("use-sample-sheets"));
  await clickUntil(page, id("use-sample-sheets"), id("match-summary"));
  await page.click(id("confirm-matches"));
  await expect(page.locator(id("confirm-matches"))).toHaveText(/Start grading/);
  await page.click(id("confirm-matches"));
  await waitForGrading(page);
  await clickUntil(page, id("go-to-review"), id("review-queue"));
  await page.click(id("accept-all-high"));
  await page.click(id("confirm-accept-high"));
  await page.click(id("filter-pending"));
  for (let i = 0; i < 6; i++) await page.keyboard.press("a");
  await expect(page.locator(id("reviewed-count"))).toContainText(/(\d+) of \1/);
  await page.click(id("finalise-assessment"));
  await expect(page.locator(id("finalise-notes"))).toBeVisible();

  await page.goto("/sections/sec_8b");
  await expect(page.locator(id("mastery-before-after"))).toContainText("36%");
  await expect(page.locator(id("mastery-before-after"))).toContainText("71%");
});
