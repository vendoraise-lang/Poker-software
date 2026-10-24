import { test, expect, type Page } from "@playwright/test";
import { getQuestion, MODULES } from "../lib/academy/content";
import { newHand, legal } from "../lib/poker";
import { freshSession, tableAction } from "../lib/hand-session";
import { collectBackup } from "../lib/backup";
async function playHand(page: Page) {
  for (let i = 0; i < 12; i++) {
    const next = page.getByRole("button", { name: /Next hand|New session/ });
    const action = page.getByRole("button", { name: /^Call|^Check/ }).first();
    await expect(async () =>
      expect(
        (await next.count()) > 0 ||
          ((await action.count()) > 0 && (await action.isEnabled())),
      ).toBe(true),
    ).toPass({ timeout: 15000 });
    if (await next.count()) break;
    await action.click();
  }
  await expect(
    page.getByRole("button", { name: /Next hand|New session/ }),
  ).toBeVisible();
}
function recorded() {
  let game = newHand(99),
    session = freshSession(game);
  while (game.street !== "Showdown") {
    const next = tableAction(
      session,
      game,
      legal(game).call ? "call" : "check",
    );
    game = next.game;
    session = next.session;
  }
  return {
    version: 1,
    hands: 1,
    wins: game.winners.includes(0) ? 1 : 0,
    decisions: [],
    lessons: [],
    table: session,
  };
}
for (const width of [390, 1440])
  test(`complete beginner release journey at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "Start your first lesson →" }).click();
    for (const l of MODULES[0].lessons) {
      const q = getQuestion(l.practiceId),
        article = page.locator(`[data-question="${q.id}"]`);
      await article
        .getByRole("button", {
          name: q.options.find((o) => o.id === q.accepted[0])!.label,
          exact: true,
        })
        .click();
      await article
        .locator("..")
        .getByRole("button", { name: "Mark lesson explored", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Assessment", exact: true }).click();
    await page
      .getByRole("button", { name: "Start assessment", exact: true })
      .click();
    for (let i = 0; i < 4; i++) {
      const article = page.locator(".academy-exercise"),
        q = getQuestion((await article.getAttribute("data-question"))!);
      await article
        .getByRole("button", {
          name: q.options.find((o) => o.id === q.accepted[0])!.label,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Continue assessment", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "Finish and review assessment" })
      .click();
    await page
      .getByRole("link", { name: "Play workspace", exact: true })
      .click();
    const hidden = page.getByRole("img", { name: "Hidden card", exact: true });
    await expect(hidden.first()).toBeVisible();
    expect(
      await hidden.evaluateAll((cards) =>
        cards.some((c) => c.classList.contains("red")),
      ),
    ).toBe(false);
    await playHand(page);
    await page
      .getByRole("link", { name: "Review workspace", exact: true })
      .click();
    await expect(page.locator(".hero-decisions button").first()).toBeVisible();
    await page.locator(".hero-decisions button").last().click();
    await page
      .getByRole("button", { name: "Calculate decision equity" })
      .click();
    await expect(page.getByLabel("Decision equity result")).toBeVisible({
      timeout: 30000,
    });
    await page
      .getByRole("link", { name: "Equity workspace", exact: true })
      .click();
    await page.getByLabel("Equity example").selectOption("royal-split");
    await page
      .getByRole("button", { name: "Calculate equity", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Equity results" }),
    ).toContainText("33.33%");
    await page
      .getByRole("link", { name: "Train workspace", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Raise to 2.5 BB", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "Decisions", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pokerlab-training-v1")!).attempts
            .length,
      ),
    ).toBe(1);
    await page
      .getByRole("link", { name: "Dashboard workspace", exact: true })
      .click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page
      .getByRole("link", { name: "Academy workspace", exact: true })
      .click();
    await expect(page.locator(".academy-stats")).toContainText("1 / 7");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
for (const raw of ['{"version":88,"hands":7}', "null", "not-json"])
  test(`corrupt game record is not overwritten: ${raw}`, async ({ page }) => {
    await page.addInitScript((raw) => {
      if (!localStorage.getItem("pokerlab-progress"))
        localStorage.setItem("pokerlab-progress", raw);
    }, raw);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Reset saved table" }),
    ).toBeVisible();
    await page.waitForTimeout(1100);
    expect(
      await page.evaluate(() => localStorage.getItem("pokerlab-progress")),
    ).toBe(raw);
  });
test("corrupt training stays untouched through practice and reload, then recovers through confirmed backup", async ({
  page,
}) => {
  const raw = '{"version":99,"attempts":["do not erase"]}';
  await page.addInitScript((raw) => {
    if (!localStorage.getItem("pokerlab-training-v1"))
      localStorage.setItem("pokerlab-training-v1", raw);
  }, raw);
  await page.goto("/?workspace=Train");
  await expect(
    page.getByRole("alert").filter({ hasText: "Training storage" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Raise to 2.5 BB" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("pokerlab-training-v1")),
  ).toBe(raw);
  await page.reload();
  expect(
    await page.evaluate(() => localStorage.getItem("pokerlab-training-v1")),
  ).toBe(raw);
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  const b = collectBackup({ getItem: () => null });
  await page.getByLabel("Import progress JSON").setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(b)),
  });
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByRole("button", { name: "Raise to 2.5 BB" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-training-v1")!).version,
    ),
  ).toBe(1);
});
test("newer records from another tab survive stale game and training writes", async ({
  page,
}) => {
  await page.goto("/?workspace=Learn");
  await expect(
    page.getByRole("button", { name: "Mark as explored", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("pokerlab-progress")!);
    p.hands = 77;
    localStorage.setItem("pokerlab-progress", JSON.stringify(p));
  });
  await page
    .getByRole("button", { name: "Mark as explored", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "another tab" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
    ),
  ).toBe(77);
  await page.getByRole("link", { name: "Train workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Raise to 2.5 BB" }),
  ).toBeVisible();
  const replacement = {
    version: 1,
    attempts: [
      {
        id: 77,
        kind: "decision",
        target: "open-utg-aa",
        choice: "Fold",
        source: "practice",
      },
    ],
    sessions: [],
    daily: null,
  };
  await page.evaluate(
    (p) => localStorage.setItem("pokerlab-training-v1", JSON.stringify(p)),
    replacement,
  );
  await page.getByRole("button", { name: "Raise to 2.5 BB" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Training storage" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokerlab-training-v1")!),
    ),
  ).toEqual(replacement);
});
async function injectWorkerFault(page: Page, fault: string) {
  await page.addInitScript((fault) => {
    const Native = window.Worker;
    let used = false;
    window.Worker = new Proxy(Native, {
      construct(target, args) {
        if (used) return Reflect.construct(target, args);
        used = true;
        if (fault === "construct")
          throw Error("Injected worker startup failure");
        const fake = {
          onmessage: null as ((e: MessageEvent) => void) | null,
          onerror: null as ((e: ErrorEvent) => void) | null,
          onmessageerror: null as ((e: MessageEvent) => void) | null,
          terminate() {},
          postMessage() {
            if (fault === "post")
              throw Error("Injected worker postMessage failure");
            queueMicrotask(() => {
              if (fault === "error") fake.onerror?.(new ErrorEvent("error"));
              else fake.onmessageerror?.(new MessageEvent("messageerror"));
            });
          },
        };
        return fake;
      },
    });
  }, fault);
}
for (const fault of ["construct", "post", "error", "message"])
  test(`equity worker ${fault} failure permits a successful retry`, async ({
    page,
  }) => {
    await injectWorkerFault(page, fault);
    await page.goto("/?workspace=Equity");
    await page.getByLabel("Equity example").selectOption("royal-split");
    const calculate = page.getByRole("button", {
      name: "Calculate equity",
      exact: true,
    });
    await calculate.click();
    await expect(page.locator('.error[role="alert"]')).toBeVisible();
    await expect(calculate).toBeEnabled();
    await expect(
      page.getByRole("region", { name: "Equity results" }),
    ).toHaveCount(0);
    await calculate.click();
    await expect(
      page.getByRole("region", { name: "Equity results" }),
    ).toContainText("33.33%", { timeout: 30000 });
  });
for (const fault of ["post", "message"])
  test(`review worker ${fault} failure permits a successful retry`, async ({
    page,
  }) => {
    const p = recorded();
    await page.addInitScript(
      (p) => localStorage.setItem("pokerlab-progress", JSON.stringify(p)),
      p,
    );
    await injectWorkerFault(page, fault);
    await page.goto("/review");
    await page.locator(".hero-decisions button").last().click();
    const calculate = page.getByRole("button", {
      name: "Calculate decision equity",
    });
    await calculate.click();
    await expect(page.locator('.error[role="alert"]')).toBeVisible();
    await expect(calculate).toBeEnabled();
    await calculate.click();
    await expect(page.getByLabel("Decision equity result")).toBeVisible({
      timeout: 30000,
    });
  });
test("skip link, keyboard tabs, focus and mobile target sizes support the release journey", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/?workspace=Train");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const decisions = page.getByRole("tab", { name: "Decisions", exact: true });
  await decisions.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Ranges", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Ranges", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  const target = page.locator(".hand-matrix td button").first();
  const box = await target.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("tab", { name: "Ranges", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Equity", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".workspace-links a")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
});
