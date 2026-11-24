import { expect, test } from "@playwright/test";
import { clickUntil, id, signInFresh, waitForGrading } from "./helpers";

test("flow 1: grade Weekly Test 4 and review it to Final", async ({ page }) => {
  await signInFresh(page);
  await clickUntil(page, id("todo-asm_8b_wt4"), id("match-summary"));
  await expect(page.locator(id("match-summary"))).toContainText("52 sheets");
  await expect(page.locator(id("match-summary"))).toContainText("2 to check");
  await clickUntil(page, id("confirm-matches"), id("grading-progress")); // "Start grading"
  await waitForGrading(page);
  await expect(page.locator(id("band-count-high"))).toContainText("40");
  await expect(page.locator(id("band-count-medium"))).toContainText("9");
  await expect(page.locator(id("band-count-low"))).toContainText("3");
  await expect(page.locator(id("answers-graded-count"))).toContainText("260");

  await clickUntil(page, id("go-to-review"), id("review-queue"));
  const card = page.locator(id("answer-review-card"));
  await expect(card).toHaveAttribute("data-band", "low");
  await expect(page.locator(id("review-student"))).toContainText("Meera Krishnan · Q4");
  await expect(page.locator(id("review-marks"))).toContainText("2 / 4");
  await expect(page.locator(id("confidence-reasons"))).toContainText("disagreed by 1 mark");

  // The AI gave 2/4; the correct mark is 3/4. Change step 3 with a note.
  await page.keyboard.press("e");
  await page.fill(id("step-input-3"), "1");
  await page.fill(id("override-note"), "x = 36 is the final working; x = 38 is crossed out.");
  await page.click(id("save-override"));

  // The injection answer is in the Low band and graded on its merits.
  await page.click('[data-demo-id="queue-item-ag_sub_asm_8b_wt4_8b_21_5"]');
  await expect(page.locator(id("confidence-reasons"))).toContainText("instructions to the grader");
  await expect(page.locator(id("review-marks"))).toContainText("3 / 6");

  // Accept the remaining Low/Medium answers with the keyboard, then bulk-accept High.
  for (let i = 0; i < 11; i++) await page.keyboard.press("a");
  await page.click(id("accept-all-high"));
  await expect(page.locator(id("accept-high-dialog"))).toContainText("Accept 248");
  await page.click(id("confirm-accept-high"));
  await expect(page.locator(id("reviewed-count"))).toContainText("260 of 260");
  await page.click(id("finalise-assessment"));
  await expect(page.locator(id("finalise-notes"))).toContainText("Final");

  await clickUntil(page, id("view-results"), id("results-table"));
  const meera = page.locator(id("results-row-25"));
  await expect(meera).toContainText("Meera Krishnan");
  await expect(meera.locator("td").nth(4)).toContainText("3");
  await expect(page.locator(id("export-csv"))).toHaveAttribute("href", /results\.csv$/);
  const csv = await page.request.get("/api/assessments/asm_8b_wt4/results.csv");
  expect(await csv.text()).toContain("Meera Krishnan");
});
