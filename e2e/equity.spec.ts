import { test, expect, type Page } from "@playwright/test";
async function lab(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("tab", { name: "Equity", exact: true }).click();
  await expect(page.getByLabel("Equity hero hand")).toBeVisible();
}
const results = (page: Page) =>
  page.getByRole("region", { name: "Equity results" });
async function calculate(page: Page) {
  await page
    .getByRole("button", { name: "Calculate equity", exact: true })
    .click();
  await expect(results(page)).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("status").filter({ hasText: "Calculation complete." }),
  ).toBeVisible({ timeout: 30000 });
}
test("worker enumerates split pots and compares a known turn versus a river runout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await lab(page);
  await page.getByLabel("Equity example").selectOption("royal-split");
  await calculate(page);
  await expect(
    results(page).getByText("EXACT ENUMERATION", { exact: true }),
  ).toBeVisible();
  await expect(results(page).locator(".equity-share strong")).toHaveText(
    "33.33%",
  );
  await expect(results(page).locator("tbody tr").first()).toContainText(
    "100.00%",
  );
  await expect(results(page)).toContainText(
    "1 equally likely outcomes enumerated",
  );
  await page.getByLabel("Equity example").selectOption("dirty-flush");
  await calculate(page);
  await expect(results(page).locator(".equity-share strong")).toHaveText(
    "15.91%",
  );
  await expect(results(page)).toContainText("44 equally likely outcomes");
  await page.getByRole("button", { name: "Pin result for comparison" }).click();
  await page.getByLabel("Equity board").fill("Js 7s 2d 9c 3s");
  await expect(
    page.getByText("Previous result — inputs changed.", { exact: false }),
  ).toBeVisible();
  await calculate(page);
  await expect(results(page).locator(".equity-share strong")).toHaveText(
    "100.00%",
  );
  await expect(results(page).locator(".equity-comparison")).toContainText(
    "84.09 percentage points",
  );
  expect(errors).toEqual([]);
});
test("card picker blocks known cards and calculation rejects duplicates and impossible board sizes", async ({
  page,
}) => {
  await lab(page);
  await expect(
    page.getByRole("button", { name: "Pick Ks", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Clear selected group" }).click();
  await page.getByRole("button", { name: "Pick As", exact: true }).click();
  await page.getByRole("button", { name: "Pick Ah", exact: true }).click();
  await expect(page.getByLabel("Equity hero hand")).toHaveValue("As Ah");
  await page.getByLabel("Card picker target").selectOption("board");
  await expect(
    page.getByRole("button", { name: "Pick As", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Clear selected group" }).click();
  await page.getByRole("button", { name: "Pick 2s", exact: true }).click();
  await page.getByRole("button", { name: "Pick 3d", exact: true }).click();
  await page.getByRole("button", { name: "Calculate equity" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "0/3/4/5 board cards" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pick 4c", exact: true }).click();
  await calculate(page);
  await page.getByLabel("Equity hero hand").fill("As As");
  await page.getByRole("button", { name: "Calculate equity" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "distinct cards" }),
  ).toBeVisible();
});
test("caps heavy work, cancels responsively and reproduces a Monte Carlo estimate", async ({
  page,
}) => {
  await lab(page);
  await page.getByLabel("Equity example").selectOption("six-random");
  await page.getByLabel("Monte Carlo samples").selectOption("50000");
  await page.getByRole("button", { name: "Calculate equity" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "20,000 samples" }),
  ).toBeVisible();
  await page.getByLabel("Monte Carlo samples").selectOption("20000");
  await page.getByRole("button", { name: "Calculate equity" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel calculation" }),
  ).toBeVisible();
  await expect(page.getByLabel("Simulation seed")).toBeDisabled();
  await page.getByRole("button", { name: "Cancel calculation" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Calculation cancelled." }),
  ).toBeVisible();
  await expect(results(page)).toHaveCount(0);
  await expect(page.getByLabel("Simulation seed")).toBeEnabled();
  await page.getByLabel("Monte Carlo samples").selectOption("1000");
  await calculate(page);
  await expect(results(page).locator("tbody tr")).toHaveCount(6);
  await page.getByLabel("Equity total players").selectOption("2");
  await page.getByLabel("Simulation seed").fill("4294967295");
  await calculate(page);
  await expect(
    results(page).getByText("MONTE CARLO ESTIMATE", { exact: true }),
  ).toBeVisible();
  await expect(results(page)).toContainText("1,000 samples drawn");
  await expect(results(page)).toContainText("Hoeffding");
  const first = await results(page).locator("tbody").innerText();
  await calculate(page);
  expect(await results(page).locator("tbody").innerText()).toBe(first);
});
test("draw exercises teach overlap, approximate rules and known dirty outs", async ({
  page,
}) => {
  await lab(page);
  await page.getByRole("button", { name: "Outs trainer", exact: true }).click();
  await page.getByLabel("Draw exercise").selectOption("3");
  await page.getByRole("button", { name: "15 cards", exact: true }).click();
  await expect(page.getByText("✓ Correct pattern count")).toBeVisible();
  await expect(page.locator(".answer-feedback")).toContainText(
    "9 + 8 − 2 = 15",
  );
  await expect(page.locator(".answer-feedback")).toContainText(
    "Rule of 2 and 4 · approximate",
  );
  await expect(page.locator(".answer-feedback")).toContainText(
    "All 15 are uncertain",
  );
  await page
    .getByRole("button", { name: "Explore clean versus uncertain outs" })
    .click();
  await expect(page.locator(".clean-outs-demo")).toContainText(
    "only 7 also win",
  );
  await expect(page.locator(".clean-outs-demo")).toContainText("2s, 9s");
  await page
    .getByRole("button", { name: "Multiway lessons", exact: true })
    .click();
  await expect(page.locator(".multiway-lesson")).toHaveCount(4);
  await expect(
    page.getByText("Do not multiply independent heads-up probabilities.", {
      exact: false,
    }),
  ).toBeVisible();
});
for (const width of [320, 390, 768, 1440])
  test(`probability lab and exact results fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await lab(page);
    await page.getByLabel("Equity example").selectOption("royal-split");
    await calculate(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440)
      await page.screenshot({
        path: "/tmp/pokerlab-phase4-equity.png",
        fullPage: true,
      });
    for (const name of ["Outs trainer", "Multiway lessons"]) {
      await page.getByRole("button", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
