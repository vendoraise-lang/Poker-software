import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { newHand, legal } from "../lib/poker";
import { freshSession, tableAction } from "../lib/hand-session";
// axe-core is already locked in the ESLint accessibility toolchain; resolve it
// from its declaring dependency rather than add another application package.
type AxeReport = { violations: unknown[]; incomplete: unknown[] };
const require = createRequire(import.meta.url),
  axePath = createRequire(require.resolve("eslint-plugin-jsx-a11y")).resolve(
    "axe-core/axe.min.js",
  );
for (const width of [390, 1440])
  test(`automated accessibility audit of release surfaces at ${width}px`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    async function scan(label: string) {
      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: { run(options: unknown): Promise<AxeReport> };
          }
        ).axe;
        return axe.run({
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
          },
        });
      });
      await info.attach(`${label}-axe`, {
        body: JSON.stringify(
          { violations: result.violations, incomplete: result.incomplete },
          null,
          2,
        ),
        contentType: "application/json",
      });
      expect(
        result.violations,
        `${label}: automated violations (incomplete checks still require human examination)`,
      ).toEqual([]);
    }
    for (const [path, current] of [
      ["/?workspace=Practice", "Play"],
      ["/?workspace=Train", "Train"],
      ["/?workspace=Equity", "Equity"],
      ["/review", "Review"],
      ["/academy", "Academy"],
      ["/?workspace=Dashboard", "Dashboard"],
      ["/practice/draws", "Train"],
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("link", { name: `${current} workspace`, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      if (path === "/?workspace=Train")
        await expect(
          page.getByLabel("Difficulty", { exact: true }),
        ).toBeVisible();
      if (current === "Academy")
        await expect(
          page.getByRole("button", { name: "Mark lesson explored" }).first(),
        ).toBeVisible();
      await scan(current);
    }
    await page.goto("/?workspace=Train");
    await page.getByRole("tab", { name: "Ranges", exact: true }).click();
    await scan("range-matrix");
    let game = newHand(99),
      session = freshSession(game);
    while (game.street !== "Showdown") {
      const n = tableAction(session, game, legal(game).call ? "call" : "check");
      game = n.game;
      session = n.session;
    }
    await page.evaluate(
      (session) =>
        localStorage.setItem(
          "pokerlab-progress",
          JSON.stringify({
            version: 1,
            hands: 1,
            wins: 0,
            decisions: [],
            lessons: [],
            table: session,
          }),
        ),
      session,
    );
    await page.goto("/review");
    await page.locator(".hero-decisions button").last().click();
    await scan("completed-review-decision");
  });
