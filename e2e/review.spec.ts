import { test, expect, type Page } from "@playwright/test";
import { newHand, legal } from "../lib/poker";
import { freshSession, tableAction } from "../lib/hand-session";
import { buildReview } from "../lib/review/model";
import { expandRange } from "../lib/equity/ranges";
import { HAND_CLASSES } from "../lib/training/ranges";
import { readFile } from "node:fs/promises";
function recorded() {
  let game = newHand(99),
    session = freshSession(game);
  while (game.street !== "Showdown") {
    const n = tableAction(session, game, legal(game).call ? "call" : "check");
    game = n.game;
    session = n.session;
  }
  return {
    version: 1,
    hands: 1,
    wins: game.winners.includes(0) ? 1 : 0,
    decisions: [],
    lessons: ["position"],
    table: session,
  };
}
const saved = recorded(),
  points = buildReview(saved.table.active).decisions;
async function seed(page: Page) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("pokerlab-progress"))
      localStorage.setItem("pokerlab-progress", JSON.stringify(data));
  }, saved);
}
async function studio(page: Page) {
  await seed(page);
  await page.goto("/review");
  await expect(
    page.getByRole("heading", { name: "Hand Review Studio", exact: true }),
  ).toBeVisible();
}
test("dedicated studio highlights every decision and never carries later reveals backward", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.locator(".hero-decisions button")).toHaveCount(4);
  await page.locator(".hero-decisions button").nth(1).click();
  await expect(
    page.getByRole("heading", { name: "Flop · You chose check" }),
  ).toBeVisible();
  await expect(page.locator(".replay-board .playing-card")).toHaveCount(3);
  await expect(page.locator(".replay-seats .card-back")).toHaveCount(6);
  await expect(page.locator(".decision-review .post-prior")).not.toContainText(
    "River",
  );
  await expect(
    page.getByText("Effective behind, deepest opponent", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".street-jumps")
    .getByRole("button", { name: "Showdown", exact: true })
    .click();
  await expect(page.locator(".replay-seats .card-back")).toHaveCount(0);
  await page.locator(".hero-decisions button").first().click();
  await expect(page.locator(".replay-board .playing-card")).toHaveCount(0);
  await expect(page.locator(".replay-seats .card-back")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(1);
});
test("decision equity sends only legally known inputs and compares an earlier street", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.Worker;
    const w = window as unknown as { reviewMessages: unknown[] };
    w.reviewMessages = [];
    window.Worker = class extends Original {
      postMessage(message: unknown) {
        w.reviewMessages.push(message);
        super.postMessage(message);
      }
    };
  });
  await studio(page);
  await page.locator(".hero-decisions button").nth(2).click();
  await page
    .getByLabel("Review equity comparison")
    .selectOption(String(points[1].commandIndex));
  const start = Date.now();
  await page.getByRole("button", { name: "Calculate decision equity" }).click();
  await expect(
    page.locator('[aria-label="Decision equity result"]'),
  ).toBeVisible({ timeout: 30000 });
  console.log("REVIEW_BROWSER_WORKER_MS", Date.now() - start);
  const messages = await page.evaluate(
    () =>
      (
        window as unknown as {
          reviewMessages: {
            input: {
              hero: unknown[];
              board: unknown[];
              opponents: unknown[];
              seed: number;
            };
          }[];
        }
      ).reviewMessages,
  );
  expect(messages).toHaveLength(2);
  expect(messages.map((m) => m.input.board.length)).toEqual([3, 4]);
  for (const m of messages) {
    expect(m.input.opponents).toEqual([null, null, null]);
    expect(m.input.seed).toBe(2026);
    expect(m.input).not.toHaveProperty("deck");
  }
  await expect(
    page.locator('[aria-label="Decision equity result"]'),
  ).toContainText("Monte Carlo");
});
test("range grid, saved reflections and topic links preserve distinct-context evidence", async ({
  page,
}) => {
  await studio(page);
  await page.locator(".hero-decisions button").nth(1).click();
  await expect(page.locator(".range-builder td button")).toHaveCount(169);
  await page.getByRole("button", { name: "Clear grid", exact: true }).click();
  const hand = HAND_CLASSES.find(
    (h) =>
      expandRange({ version: 1, weights: { [h]: 100 } }, [
        ...points[1].hero,
        ...points[1].board,
      ]).length,
  )!;
  await page.getByLabel("Range weight brush").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page
    .getByRole("button", { name: `${hand} weight 0`, exact: true })
    .click();
  await page
    .getByRole("button", { name: `${hand} weight 1`, exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#weighted-cell-0-1")).toBeFocused();
  await page.getByRole("button", { name: "Apply weighted range" }).click();
  await expect(page.getByText("Current model: weighted range.")).toBeVisible();
  const weightedStart = Date.now();
  await page.getByRole("button", { name: "Calculate decision equity" }).click();
  await expect(
    page.locator('[aria-label="Decision equity result"]'),
  ).toBeVisible({ timeout: 30000 });
  console.log("REVIEW_WEIGHTED_WORKER_MS", Date.now() - weightedStart);
  await page.getByLabel("Reflection: Draws & redraws").selectOption("practice");
  await page
    .getByRole("button", { name: "Save review & practice plan" })
    .click();
  await page
    .getByRole("button", { name: "Save review & practice plan" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pokerlab-review-v1")!).observations
            .length,
      ),
    )
    .toBe(1);
  await page.reload();
  await page.locator(".hero-decisions button").nth(1).click();
  await expect(page.getByText("Current model: weighted range.")).toBeVisible();
  await expect(page.getByLabel("Reflection: Draws & redraws")).toHaveValue(
    "practice",
  );
  await expect(
    page
      .locator(".review-topic-grid article")
      .filter({ hasText: "Draws & redraws" }),
  ).toContainText("1 distinct contexts");
  await page.getByRole("link", { name: "Practice draws & redraws →" }).click();
  await expect(page).toHaveURL(/\/practice\/draws$/);
  await expect(page.getByLabel("Postflop concept")).toHaveValue("draws");
});
test("version 4 backup contains review data; malformed ranges reject and v3 imports preserve it", async ({
  page,
}, info) => {
  await studio(page);
  await page.getByRole("link", { name: "Practice room", exact: true }).click();
  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress JSON" }).click();
  const file = await download,
    path = info.outputPath("review-v4.json");
  await file.saveAs(path);
  const payload = JSON.parse(await readFile(path, "utf8"));
  expect(payload.version).toBe(4);
  expect(payload.review.version).toBe(1);
  const input = page.getByLabel("Import progress JSON");
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...payload,
        review: {
          ...payload.review,
          ranges: [{ version: 1, weights: { ZZ: 100 } }, null, null],
        },
      }),
    ),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "No progress was replaced" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const original = await page.evaluate(() =>
    localStorage.getItem("pokerlab-review-v1"),
  );
  await input.setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...payload, version: 3, review: undefined }),
    ),
  });
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByRole("button", { name: "Practice", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("pokerlab-review-v1")),
  ).toBe(original);
});
test("missing and incomplete old histories are explained, not invented", async ({
  page,
}) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("pokerlab-progress"))
      localStorage.setItem(
        "pokerlab-progress",
        JSON.stringify({
          ...data,
          table: {
            version: 1,
            completed: [data.table.active, { broken: true }],
          },
        }),
      );
  }, saved);
  await page.goto("/review");
  await expect(
    page.getByText(
      "1 missing, incomplete or malformed hand histories were skipped",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Review completed hand").locator("option"),
  ).toHaveCount(1);
  await page.evaluate(() =>
    localStorage.setItem(
      "pokerlab-progress",
      JSON.stringify({
        version: 1,
        hands: 20,
        wins: 2,
        decisions: [],
        lessons: [],
      }),
    ),
  );
  await page.goto("/review");
  await expect(
    page.getByRole("heading", {
      name: "No completed hand available to review.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(20);
});
for (const width of [320, 390, 768, 1440])
  test(`review studio fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await studio(page);
    await page.locator(".hero-decisions button").nth(1).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440)
      await page.screenshot({
        path: "/tmp/pokerlab-phase5-review.png",
        fullPage: true,
      });
  });
