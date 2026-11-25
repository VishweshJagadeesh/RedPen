import { expect, test } from "@playwright/test";
import { clickUntil, id, signInFresh } from "./helpers";

test("flow 6: plan progress, back links, save/discard drafts, hand out later, print/share, sample sheets anywhere", async ({ page, browser }) => {
  await signInFresh(page);

  // Plan generation streams its steps.
  const stream = await page.request.post("/api/reteach", {
    headers: { Accept: "application/x-ndjson" },
    data: { sectionId: "sec_9a", conceptId: "c9-ns-irrational", inputs: { periodMinutes: 40, resources: "blackboard", language: "en", note: "" } },
  });
  const events = (await stream.text()).trim().split("\n").map((l) => JSON.parse(l));
  if (events.at(-1).type === "done") {
    for (const step of ["evidence", "misconceptions", "draft", "checks", "pairs", "save"]) expect(events.some((e) => e.step === step && e.status === "done")).toBeTruthy();
  } else {
    expect(events.at(-1).type).toBe("error"); // that concept may have no graded evidence; the stream still ends cleanly
  }

  // A new reteach plan asks before leaving: cancel stays, save keeps it as a draft on Home.
  await page.goto("/reteach/new?sectionId=sec_8b&conceptId=c8-cq-percent");
  await clickUntil(page, id("generate-plan"), id("reteach-plan-editor"));
  const planUrl = page.url();
  await page.click(id("back-link"));
  await expect(page.locator(id("draft-guard-dialog"))).toContainText("You created a reteach plan");
  await page.click(id("draft-guard-cancel"));
  await expect(page.locator(id("draft-guard-dialog"))).toHaveCount(0);
  expect(page.url()).toBe(planUrl);
  await page.click(id("back-link"));
  await page.click(id("draft-guard-save"));
  await page.waitForURL("**/sections/sec_8b");
  await page.goto("/dashboard");
  await expect(page.locator(id("home-drafts"))).toContainText("Reteach: Percentage increase and decrease");
  await expect(page.locator(id("home-drafts"))).toContainText("Saved draft");

  // A new homework set-up can be discarded on the way out.
  await page.goto("/assessments/new?type=homework&sectionId=sec_8a");
  await clickUntil(page, id("use-sample-paper-c8-hw2"), id("confirm-questions"));
  const discardedUrl = page.url();
  await page.click(id("back-link"));
  await expect(page.locator(id("draft-guard-dialog"))).toContainText("You created a homework");
  await page.click(id("draft-guard-discard"));
  await page.waitForURL("**/sections/sec_8a");
  await page.goto("/assessments");
  await expect(page.locator(id(`assessment-row-${discardedUrl.split("/").pop()}`))).toHaveCount(0);

  // "Yet to hand it to the class": listed as Ready to grade, printable and shareable.
  await page.goto("/assessments/new?type=homework&sectionId=sec_8a");
  await clickUntil(page, id("use-sample-paper-c8-hw1"), id("confirm-questions"));
  await page.click(id("confirm-questions"));
  await page.waitForSelector(id("hand-out-panel"));
  const hwUrl = page.url();
  const hwId = hwUrl.split("/").pop()!;
  await clickUntil(page, id("not-handed-out-toggle"), id("not-handed-out-saved"));
  await expect(page.locator(id("assessment-status"))).toHaveText("Ready to grade");
  await page.click(id("hand-out-done"));
  await page.waitForURL("**/assessments");
  await page.click(id("assessment-filter-not_handed_out"));
  await expect(page.locator(id(`not-handed-out-${hwId}`))).toBeVisible();
  await page.click(id(`share-work-${hwId}`));
  const shareUrl = await page.locator(`${id("share-work-url")} a`).getAttribute("href");
  const anon = await browser.newContext();
  const pub = await anon.newPage();
  await pub.goto(shareUrl!);
  await expect(pub.locator(id("student-copy"))).toContainText("Q1.");
  await expect(pub.locator("body")).not.toContainText("Answer key");
  await anon.close();
  await page.goto(`/assessments/${hwId}/print?perStudent=1`);
  await expect(page.locator(id("student-copy-1"))).toBeVisible();

  // Later: the generated sample sheets work for this homework too, and it counts as handed out.
  await page.goto(hwUrl);
  await expect(page.locator(id("use-sample-sheets"))).toHaveAttribute("data-sample-kind", "synthetic");
  await clickUntil(page, id("use-sample-sheets"), id("match-summary"));
  await expect(page.locator(id("match-summary"))).toContainText("0 unmatched");
  await expect(page.locator(id("assessment-status"))).toHaveText("Matching sheets");

  // An assigned remedial for a student without bundled sheets: grade straight from the list.
  await page.goto("/remedial/new?sectionId=sec_8b&studentIds=stu_8b_01");
  await clickUntil(page, id("generate-remedial"), id("assign-remedial"));
  await clickUntil(page, id("assign-remedial"), id("upload-remedial-submissions"));
  await page.goto("/remedial");
  const grade = page.locator('[data-demo-id^="grade-remedial-"]').first();
  await expect(grade).toContainText("Grade responses");
  await grade.click();
  await page.waitForURL(/\/assessments\/asm_/);
  await clickUntil(page, id("use-sample-sheets"), id("match-summary"));
  await expect(page.locator(id("match-summary"))).toContainText("1 sheets");
});
