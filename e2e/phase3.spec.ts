import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function train(page: Page, tab: string) {
  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("tab", { name: tab, exact: true }).click();
}
test("postflop legal choices, missed review and distinct retrieval evidence", async ({
  page,
}) => {
  await page.goto("/");
  await train(page, "Postflop");
  await expect(
    page.getByLabel("Postflop exercise").locator("option"),
  ).toHaveCount(30);
  await page.getByLabel("Postflop exercise").selectOption("f-value-set");
  await expect(page.locator(".post-actions button")).toHaveCount(2);
  await expect(page.locator(".post-actions")).not.toContainText("call");
  await page
    .locator(".post-actions")
    .getByRole("button", { name: "check", exact: true })
    .click();
  await expect(
    page.getByText("A concept to revisit", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Postflop exercise").selectOption("f-value-set");
  await page
    .locator(".post-actions")
    .getByRole("button", { name: "bet 3 BB", exact: true })
    .click();
  await expect(page.getByText("✓ Defensible teaching line")).toBeVisible();
  await expect(
    page.locator(".concept-coverage").filter({ hasText: "Value betting" }),
  ).toContainText("0 / 1 accepted");
  await page.getByLabel("Postflop practice mode").selectOption("missed");
  await expect(
    page.getByLabel("Postflop exercise").locator("option"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Analyze this board →" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your actual made hand: Three of a kind",
    }),
  ).toBeVisible();
});
test("texture analyzer distinguishes draws, made hands, river misses and invalid cards", async ({
  page,
}) => {
  await page.goto("/");
  await train(page, "Texture");
  await expect(
    page.getByText("Your known cards have a flush draw", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Board cards", { exact: true }).fill("Ks 9s 3s");
  await page.getByRole("button", { name: "Analyze cards" }).click();
  await expect(
    page.getByRole("heading", { name: "Your actual made hand: Flush" }),
  ).toBeVisible();
  await page.getByLabel("Board cards", { exact: true }).fill("Js 7s 2d 4c 9h");
  await page.getByRole("button", { name: "Analyze cards" }).click();
  await expect(
    page.getByText("River: draws are closed.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your actual made hand: High card" }),
  ).toBeVisible();
  await page.getByLabel("Board cards", { exact: true }).fill("As As 3c");
  await page.getByRole("button", { name: "Analyze cards" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "distinct cards" }),
  ).toBeVisible();
});
test("unfinished table survives reload and completed hands replay without early reveals", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const passive = page.getByRole("button", { name: /^(Check|Call \d+)/ });
  await expect(passive).toBeEnabled({ timeout: 10000 });
  const active = await page.evaluate(
    () => JSON.parse(localStorage.getItem("pokerlab-progress")!).table.active,
  );
  await page.reload();
  await expect(passive).toBeEnabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).table.active,
    ),
  ).toEqual(active);
  for (let i = 0; i < 40; i++) {
    if (
      await page.getByRole("button", { name: /Next hand|New session/ }).count()
    )
      break;
    await expect(async () => {
      expect(
        (await page
          .getByRole("button", { name: /Next hand|New session/ })
          .count()) || (await passive.isEnabled()),
      ).toBeTruthy();
    }).toPass({ timeout: 15000 });
    if (
      await page.getByRole("button", { name: /Next hand|New session/ }).count()
    )
      break;
    await passive.click();
  }
  await expect(page.getByLabel("Replay step", { exact: true })).toBeVisible();
  await expect(page.locator(".replay-seats .card-back")).toHaveCount(6);
  await page
    .locator(".street-jumps")
    .getByRole("button", { name: "Flop", exact: true })
    .click();
  await expect(page.locator(".replay-board .playing-card")).toHaveCount(3);
  await expect(page.locator(".replay-seats .card-back")).toHaveCount(6);
  await page
    .locator(".street-jumps")
    .getByRole("button", { name: "River", exact: true })
    .click();
  await expect(page.locator(".replay-board .playing-card")).toHaveCount(5);
  const hands = await page.evaluate(
    () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
  );
  await page.reload();
  await expect(page.getByLabel("Replay step", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(hands);
  expect(errors).toEqual([]);
});
test("corrupt hand is left untouched until explicit safe reset", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("pokerlab-progress"))
      localStorage.setItem(
        "pokerlab-progress",
        JSON.stringify({
          version: 1,
          hands: 3,
          wins: 1,
          decisions: [],
          lessons: ["position"],
          table: { version: 99 },
        }),
      );
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Reset saved table" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pokerlab-progress")!).table.version,
    ),
  ).toBe(99);
  await page.getByRole("button", { name: "Reset saved table" }).click();
  await expect(
    page.getByRole("button", { name: "Reset saved table" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pokerlab-progress")!).table.version,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(3);
});
test("export is downloadable; invalid imports and cancelled replacements do not overwrite progress", async ({
  page,
}, info) => {
  await page.goto("/");
  await train(page, "Data");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress JSON" }).click();
  const file = await downloaded;
  const path = info.outputPath("backup.json");
  await file.saveAs(path);
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.version).toBe(3);
  expect(backup.game.table.active).toBeTruthy();
  const original = backup.game.hands;
  backup.game.hands = 23;
  backup.game.wins = 0;
  const input = page.getByLabel("Import progress JSON");
  const payload = {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  };
  await input.setInputFiles(payload);
  await expect(
    page.getByRole("dialog", { name: "Replace saved progress?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(original);
  await page.getByRole("button", { name: "Cancel import" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(original);
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "No progress was replaced" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await input.setInputFiles({
    ...payload,
    buffer: Buffer.from(JSON.stringify({ ...backup, version: 999 })),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Unsupported backup" }),
  ).toBeVisible();
  await input.setInputFiles(payload);
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByRole("button", { name: "Practice", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
      ),
    )
    .toBe(23);
});
for (const width of [320, 390, 768, 1440])
  test(`Phase 3 tools fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await train(page, "Postflop");
    for (const name of ["Postflop", "Texture", "Data"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 1440) {
      await page.getByRole("tab", { name: "Postflop", exact: true }).click();
      await page.screenshot({
        path: "/tmp/pokerlab-phase3.png",
        fullPage: true,
      });
    }
  });
