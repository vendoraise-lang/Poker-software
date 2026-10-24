import { test, expect } from "@playwright/test";
test("plays a full hand, records decisions and restores learning progress", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Take your seat." }),
  ).toBeVisible();
  for (let step = 0; step < 35; step++) {
    if (
      await page.getByRole("button", { name: /Next hand|New session/ }).count()
    )
      break;
    const passive = page.getByRole("button", { name: /^(Check|Call \d+)/ });
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
  await expect(
    page.getByRole("button", { name: /Next hand|New session/ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("pokerlab-progress")!).hands,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: /Dashboard/ }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  const decisions = await page.locator("tbody tr").count();
  expect(decisions).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Learn/ }).click();
  await page.getByRole("button", { name: "Mark as explored" }).click();
  await expect(
    page.getByRole("button", { name: "✓ Lesson explored" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Dashboard/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(decisions);
  await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile table fits, exposes legal controls and toggle works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({ path: "/tmp/pokerlab-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("switch", { name: "Training hints" }).click();
  await expect(
    page.getByText("Hints are paused.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Fold/ })).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole("button", { name: /^Fold/ }).click();
  await expect(page.getByText("A hand, a little wiser.")).toBeVisible({
    timeout: 15000,
  });
});
test("desktop table renders without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/");
  await page.screenshot({ path: "/tmp/pokerlab-desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const width of [320, 768, 1024]) {
  test(`responsive layout fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
