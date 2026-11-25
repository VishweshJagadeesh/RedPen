import { expect, test } from "@playwright/test";
import { clickUntil, id, signInFresh } from "./helpers";

test("class-wide weak concepts on Home and the sidebar; class page trend, roster search, heatmap, homework", async ({ page }) => {
  await signInFresh(page);

  // Notifications next to the classes and on Home.
  await expect(page.locator(id("nav-weak-badge-8B"))).toHaveText("3");
  await expect(page.locator(id("nav-weak-badge-8A"))).toHaveCount(0);
  await expect(page.locator(id("weak-concepts-banner"))).toContainText("3 class-wide weak concepts");
  const homeWeak = page.locator(id("home-weak-concepts"));
  await expect(homeWeak).toContainText("Transposing terms");
  await expect(homeWeak).toContainText("Percentage increase and decrease");
  await expect(homeWeak).toContainText("spotted in Homework 3");

  // Jump straight into the class from a weak-concept card.
  await clickUntil(page, `${id("home-weak-8B-c8-le-transposing")} ${id("home-weak-view-class")}`, id("class-dashboard"));
  await expect(page.locator(id("kpi-weak-concepts"))).toContainText("3");
  await expect(page.locator(id("kpi-latest-average"))).toContainText("Critical");
  await expect(page.locator(id("class-health"))).toContainText("57% in PT1");
  await expect(page.locator(id("weak-concept-from-homework"))).toBeVisible();

  // The trend card and the alerts card do not share a height.
  const chart = await page.locator(id("section-trend-card")).boundingBox();
  const alerts = await page.locator(id("needs-attention-card")).boundingBox();
  expect(chart && alerts).toBeTruthy();
  expect(Math.abs(chart!.height - alerts!.height)).toBeLessThan(120);

  // Homework panel.
  await expect(page.locator(id("homework-list"))).toContainText("Homework 3 — Comparing Quantities");

  // Find one student quickly.
  await page.fill(id("student-search"), "rohan");
  await expect(page.locator(id("roster-count"))).toHaveText("1 of 52");
  await expect(page.locator(id("roster-row-36"))).toContainText("41%");
  await page.fill(id("student-search"), "");
  await page.click(id("roster-filter-attention"));
  await expect(page.locator(id("roster-count"))).toHaveText("3 of 52");

  // Tidier heatmap with search and chapter grouping.
  await page.click(id("tab-heatmap"));
  await expect(page.locator(id("heatmap-concept-c8-le-transposing"))).toContainText("Weak");
  await page.fill(id("heatmap-search"), "Sneha");
  await expect(page.locator('[data-demo-id^="heatmap-row-"]')).toHaveCount(1);
  await page.click(id("heatmap-group-chapter"));
  await expect(page.locator(id("class-concept-heatmap"))).toContainText("Comparing Quantities");

  // Homework goes through the same grading flow.
  await clickUntil(page, id("grade-homework"), id("assessment-type"));
  await expect(page.locator(id("assessment-type"))).toHaveValue("homework");
  await expect(page.locator(id("assessment-section"))).toHaveValue("sec_8b");
});
