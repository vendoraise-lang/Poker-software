import { test, expect, type Page } from "@playwright/test";
import { SCENARIOS } from "../lib/training/fixtures";
async function training(page: Page) {
  await page.getByRole("button", { name: "Train", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Decisions", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Difficulty", { exact: true })).toBeVisible();
}
test("decision scoring, alternate lines, recommendations and Phase 1 data survive reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem("pokerlab-progress"))
      localStorage.setItem(
        "pokerlab-progress",
        JSON.stringify({
          version: 1,
          hands: 7,
          wins: 2,
          decisions: [],
          lessons: ["position"],
        }),
      );
  });
  await page.goto("/");
  await training(page);
  await page.getByRole("button", { name: "Fold", exact: true }).click();
  await expect(page.getByText("A useful spot to revisit")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fold", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Decision mistakes by category" }),
  ).toBeVisible();
  await expect(
    page.locator(".mistake-count").filter({ hasText: "UTG" }),
  ).toHaveText("UTG1");
  await page.getByRole("button", { name: "Practice opening ranges →" }).click();
  await expect(page.getByLabel("Decision focus")).toHaveValue("opening");
  await page.getByLabel("Difficulty", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Raise to 8 BB", exact: true })
    .click();
  await expect(page.getByText("✓ Reasonable alternative")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pokerlab-training-v1")!).attempts
            .length,
      ),
    )
    .toBe(2);
  await page.reload();
  await training(page);
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(page.getByText("50%", { exact: true }).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(7);
  expect(errors).toEqual([]);
});
test("all 169 matrix cells respond to position changes and keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await training(page);
  await page.getByRole("tab", { name: "Ranges", exact: true }).click();
  await expect(page.locator(".hand-matrix td button")).toHaveCount(169);
  await page.getByRole("button", { name: "A5s suited", exact: true }).click();
  await expect(
    page.getByText("Outside the UTG sample", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Opening position", { exact: true })
    .selectOption("BTN");
  await expect(
    page.getByText("Included in the BTN sample", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "A5s suited, in sample range", exact: true })
    .focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".range-detail h2")).toHaveText("A6s");
  await page.getByLabel("Opening position", { exact: true }).selectOption("BB");
  await expect(
    page.getByText("No unopened BB decision", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/pokerlab-phase2-ranges.png",
    fullPage: true,
  });
});
test("pot odds quizzes reveal the final-pot calculation and equity caveat", async ({
  page,
}) => {
  await page.goto("/");
  await training(page);
  await page.getByRole("tab", { name: "Pot odds", exact: true }).click();
  await page.getByRole("button", { name: "50%", exact: true }).click();
  await expect(page.getByText("Let’s walk through the price")).toBeVisible();
  await expect(page.locator(".answer-feedback")).toContainText("25%");
  await expect(page.locator(".answer-feedback")).toContainText("200 chips");
  await expect(
    page.getByText("Pot odds describe the price.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next quiz →" }).click();
  await page.getByRole("button", { name: "33.3%", exact: true }).click();
  await expect(page.getByText("✓ You found the price")).toBeVisible();
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(
    page.locator("tr").filter({ hasText: "Pot odds" }),
  ).toContainText("1 / 2");
});
test("daily session resumes and records five decisions and one completed review", async ({
  page,
}) => {
  await page.goto("/");
  await training(page);
  await page.getByRole("tab", { name: /^Daily/ }).click();
  await page.getByRole("button", { name: "Start guided session →" }).click();
  await expect(page.getByText("01 · Position changes the story")).toBeVisible();
  await page.getByRole("button", { name: "Begin five scenarios →" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pokerlab-training-v1")!).daily
            .started,
      ),
    )
    .toBe(true);
  const plan: string[] = await page.evaluate(
    () => JSON.parse(localStorage.getItem("pokerlab-training-v1")!).daily.plan,
  );
  for (let i = 0; i < 5; i++) {
    if (i === 2) {
      await page.reload();
      await training(page);
      await page.getByRole("tab", { name: /^Daily/ }).click();
    }
    await expect(
      page.getByText(new RegExp(`Daily decision ${i + 1} of 5`)),
    ).toBeVisible();
    const s = SCENARIOS.find((s) => s.id === plan[i])!;
    await page
      .getByRole("button", { name: new RegExp(`^${s.preferred}(?: |$)`) })
      .click();
    await expect(
      page.getByText("✓ Matches the teaching baseline"),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: i === 4 ? "See session review →" : "Next daily decision →",
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Your five-decision review" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete session", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "✓ Session completed" }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pokerlab-training-v1")!).sessions
            .length,
      ),
    )
    .toBe(1);
  await page.reload();
  await training(page);
  await page.getByRole("tab", { name: /^Daily/ }).click();
  await expect(
    page.getByRole("button", { name: "✓ Session completed" }),
  ).toBeDisabled();
  await expect(page.getByText("Session 1 · 5 / 5 accepted")).toBeVisible();
});
test("training works in memory when browser storage is denied", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw Error("blocked");
    };
  });
  await page.goto("/");
  await training(page);
  await expect(
    page.getByText("Training storage is unavailable.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Raise to 2.5 BB" }).click();
  await expect(page.getByText("✓ Matches the teaching baseline")).toBeVisible();
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(
    page.locator(".stat").filter({ hasText: "Training attempts" }),
  ).toContainText("1");
});
for (const width of [320, 390, 768, 1440])
  test(`all training tools fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await training(page);
    for (const name of [
      "Decisions",
      "Ranges",
      "Pot odds",
      "Analysis",
      "Daily",
    ]) {
      await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 390)
      await page.screenshot({
        path: "/tmp/pokerlab-phase2-mobile.png",
        fullPage: true,
      });
  });
