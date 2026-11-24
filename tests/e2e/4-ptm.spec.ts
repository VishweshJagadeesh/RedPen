import { expect, test } from "@playwright/test";
import { clickUntil, id, signInFresh } from "./helpers";

test("flow 4: PTM view in English and Hindi, and the parent's read-only profile", async ({ page, browser }) => {
  await signInFresh(page);
  await page.goto("/sections/sec_8b/students/stu_8b_36");
  await expect(page.locator(id("student-detail"))).toBeVisible();
  const shareHref = await page.locator(id("open-parent-profile")).getAttribute("href");
  await clickUntil(page, id("open-ptm"), id("ptm-summary"));

  await expect(page.locator(id("ptm-student-name"))).toHaveText("Rohan Kumar");
  await expect(page.locator(id("ptm-focus"))).toContainText("Transposing terms");
  await expect(page.locator(id("ptm-talking-points")).locator("li")).toHaveCount(3);
  await expect(page.locator(id("ptm-talking-points"))).toContainText("At home");
  await expect(page.locator(id("ptm-term"))).toContainText("76%");
  // Every statement links to its source test or question.
  await expect(page.locator(`${id("ptm-focus")} a`).first()).toHaveAttribute("href", /\/assessments\/.+\/results/);

  await clickUntil(page, id("ptm-language-toggle"), '[data-demo-id="ptm-summary"][data-lang="hi"]');
  await expect(page.locator(id("ptm-talking-points"))).toContainText("घर पर");

  // The parent's link works without signing in and never shows contact details.
  expect(shareHref).toBeTruthy();
  const parent = await browser.newContext();
  const pp = await parent.newPage();
  await pp.goto(new URL(shareHref!).pathname);
  await expect(pp.locator(id("student-profile"))).toContainText("Rohan Kumar");
  await expect(pp.locator(id("profile-weak-concepts"))).toContainText("Transposing terms");
  expect(await pp.content()).not.toContain("+91");
  await parent.close();
});
