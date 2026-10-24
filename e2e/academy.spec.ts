import { test, expect, type Page } from "@playwright/test";
import { QUESTIONS, MODULES, getQuestion } from "../lib/academy/content";
import {
  emptyAcademy,
  beginAssessment,
  answerAssessment,
  finishAssessment,
  academyState,
  ACADEMY_KEY,
} from "../lib/academy/progress";
import { collectBackup } from "../lib/backup";
const stamp = "2026-10-24T12:00:00.000Z";
async function academy(page: Page) {
  await page.goto("/academy");
  await expect(
    page.getByRole("heading", { name: "Understand the decision." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start assessment", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mark lesson explored" }).first(),
  ).toBeVisible();
}
async function assessmentAnswer(page: Page, correct = true) {
  const article = page.locator(".academy-exercise");
  const id = await article.getAttribute("data-question");
  const q = getQuestion(id!);
  const choice = correct
    ? q.accepted[0]
    : q.options.find((o) => !q.accepted.includes(o.id))!.id;
  await article
    .getByRole("button", {
      name: q.options.find((o) => o.id === choice)!.label,
      exact: true,
    })
    .click();
  await expect(article.getByRole("status")).toContainText(q.explanation);
  await page
    .getByRole("button", { name: "Continue assessment", exact: true })
    .click();
  return id!;
}
test("Academy navigation, seven modules and interactive lesson cycle persist alongside old progress", async ({
  page,
}) => {
  const old = {
    version: 1,
    hands: 7,
    wins: 2,
    decisions: [],
    lessons: ["position"],
  };
  await page.addInitScript((p) => {
    if (!localStorage.getItem("pokerlab-progress"))
      localStorage.setItem("pokerlab-progress", JSON.stringify(p));
  }, old);
  await page.goto("/");
  await page.getByRole("link", { name: "Academy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Understand the decision." }),
  ).toBeVisible();
  await expect(page.locator(".academy-modules button")).toHaveCount(7);
  for (const m of MODULES) {
    await page
      .locator(".academy-modules button")
      .filter({ hasText: m.title })
      .click();
    await expect(page.locator(".academy-module h2")).toHaveText(m.title);
    await expect(page.locator(".academy-module > ul li")).toHaveCount(3);
    await expect(page.locator(".academy-exercise")).toHaveCount(2);
    await expect(
      page.locator(".academy-cards .playing-card").first(),
    ).toBeVisible();
  }
  await page.locator(".academy-modules button").first().click();
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
  await assessmentAnswer(page, false);
  await page.reload();
  await expect(
    page.getByText("Question 2 of 4", { exact: false }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++) await assessmentAnswer(page);
  await page
    .getByRole("button", { name: "Finish and review assessment" })
    .click();
  await expect(
    page.getByText("3 of 4 accepted · 4 distinct first exposures.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".academy-stats")).toContainText("1 / 7");
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pokerlab-progress")!),
  );
  expect(saved.hands).toBe(7);
  expect(saved.lessons).toEqual(["position"]);
});
test("reassessment prefers unseen contexts and exhausted fixtures add no independent evidence", async ({
  page,
}) => {
  let p = emptyAcademy();
  const seen: string[] = [];
  for (let s = 0; s < 3; s++) {
    p = beginAssessment(p, 1, stamp);
    const qs = academyState(p).active!.questions;
    seen.push(...qs);
    for (const id of qs)
      p = answerAssessment(p, getQuestion(id).accepted[0], stamp);
    p = finishAssessment(p, stamp);
  }
  await page.addInitScript(
    (p) => localStorage.setItem("pokerlab-academy-v1", JSON.stringify(p)),
    p,
  );
  await academy(page);
  await page.getByRole("button", { name: "Assessment", exact: true }).click();
  await page.getByRole("button", { name: "Reassess this module" }).click();
  await expect(
    page.getByText("0 previously unseen contexts reserved", { exact: false }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await expect(
      page.getByText("Familiar context:", { exact: false }),
    ).toBeVisible();
    expect(seen).toContain(await assessmentAnswer(page));
  }
  await page
    .getByRole("button", { name: "Finish and review assessment" })
    .click();
  await expect(
    page.getByText("4 of 4 accepted · 0 distinct first exposures.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pokerlab-academy-v1")!).events.filter(
          (e: { type: string }) => e.type === "answer",
        ).length,
    ),
  ).toBe(16);
  await expect(page.locator(".academy-stats")).toContainText("12");
});
test("new reassessment uses different fixture identities", async ({ page }) => {
  await academy(page);
  await page.getByRole("button", { name: "Assessment", exact: true }).click();
  await page
    .getByRole("button", { name: "Start assessment", exact: true })
    .click();
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) ids.push(await assessmentAnswer(page));
  await page
    .getByRole("button", { name: "Finish and review assessment" })
    .click();
  await page.getByRole("button", { name: "Reassess this module" }).click();
  expect(ids).not.toContain(
    await page.locator(".academy-exercise").getAttribute("data-question"),
  );
  await expect(
    page.getByText("4 previously unseen contexts reserved", { exact: false }),
  ).toBeVisible();
});
test("malformed stored history stays untouched and study remains possible", async ({
  page,
}) => {
  const raw = '{"version":88,"events":[]}';
  await page.addInitScript(
    (raw) => localStorage.setItem("pokerlab-academy-v1", raw),
    raw,
  );
  await academy(page);
  await expect(page.getByRole("status").first()).toContainText(
    "remains untouched",
  );
  const q = QUESTIONS[0];
  await page
    .locator(`[data-question="${q.id}"]`)
    .getByRole("button", {
      name: q.options.find((o) => o.id === q.accepted[0])!.label,
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("pokerlab-academy-v1")),
  ).toBe(raw);
});
test("version 5 export, malformed import rejection, and explicit cancel preserve Academy history", async ({
  page,
}) => {
  await academy(page);
  const q = QUESTIONS[0];
  await page
    .locator(`[data-question="${q.id}"]`)
    .getByRole("button", {
      name: q.options.find((o) => o.id === q.accepted[0])!.label,
      exact: true,
    })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("pokerlab-academy-v1"),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pokerlab-progress-v5.json");
  const source = new Map<string, string>([
    [ACADEMY_KEY, JSON.stringify(emptyAcademy())],
  ]);
  const backup = collectBackup({ getItem: (k) => source.get(k) ?? null });
  await page.getByLabel("Import progress JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...backup, academy: { version: 9 } })),
  });
  await expect(page.getByText(/No progress was replaced/)).toBeVisible();
  await page.getByLabel("Import progress JSON").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel import" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("pokerlab-academy-v1")),
  ).toBe(before);
});
test("concurrent local changes are detected without silent replacement", async ({
  page,
}) => {
  await academy(page);
  const replacement = { ...emptyAcademy(), priorKeys: ["combo:pair"] };
  await page.evaluate(
    (p) => localStorage.setItem("pokerlab-academy-v1", JSON.stringify(p)),
    replacement,
  );
  const q = QUESTIONS[0];
  await page
    .locator(`[data-question="${q.id}"]`)
    .getByRole("button", {
      name: q.options.find((o) => o.id === q.accepted[0])!.label,
      exact: true,
    })
    .click();
  await expect(page.getByRole("status").first()).toContainText("another tab");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokerlab-academy-v1")!),
    ),
  ).toEqual(replacement);
});
test("Academy and practice navigation remain within narrow and wide viewports", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await academy(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".academy-modules button").first()).toBeVisible();
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Academy", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("confirmed older backup replacement preserves Academy, while confirmed version 5 restores it", async ({
  page,
}) => {
  await academy(page);
  const q = QUESTIONS[0];
  await page
    .locator(`[data-question="${q.id}"]`)
    .getByRole("button", {
      name: q.options.find((o) => o.id === q.accepted[0])!.label,
      exact: true,
    })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("pokerlab-academy-v1"),
  );
  const old = collectBackup({ getItem: () => null });
  await page.getByLabel("Import progress JSON").setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await expect(page.getByRole("dialog")).toContainText(
    "Existing Academy data will be preserved",
  );
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByRole("heading", { name: "Understand the decision." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("pokerlab-academy-v1")),
  ).toBe(before);
  const p = beginAssessment(emptyAcademy(), 3, stamp);
  const backup = { ...old, version: 5, academy: p };
  await page.getByLabel("Import progress JSON").setInputFiles({
    name: "v5.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByText("Question 1 of 4", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokerlab-academy-v1")!),
    ),
  ).toEqual(p);
});

test("keyboard study, saved review reflections and older training histories remain separate", async ({
  page,
}) => {
  const review = {
    version: 1,
    observations: [
      {
        context: JSON.stringify({
          street: "Preflop",
          hero: [
            { rank: 14, suit: 0 },
            { rank: 13, suit: 1 },
          ],
          board: [],
          position: "BTN",
          stack: 100,
          pot: 3,
          history: [],
          opponents: [],
        }),
        topic: "opening",
        first: "practice",
        latest: "practice",
        day: "2026-10-24",
      },
    ],
    ranges: [null, null, null],
  };
  const training = {
    version: 1,
    attempts: [
      {
        id: 1,
        kind: "odds",
        target: "odds-half",
        choice: "25",
        source: "practice",
      },
    ],
    sessions: [],
    daily: null,
  };
  await page.addInitScript(
    ({ review, training }) => {
      localStorage.setItem("pokerlab-review-v1", JSON.stringify(review));
      localStorage.setItem("pokerlab-training-v1", JSON.stringify(training));
    },
    { review, training },
  );
  await academy(page);
  await expect(
    page.getByText("2026-10-24 · opening · Practice requested", {
      exact: true,
    }),
  ).toBeVisible();
  const q = QUESTIONS[0],
    button = page
      .locator(`[data-question="${q.id}"]`)
      .getByRole("button", {
        name: q.options.find((o) => o.id === q.accepted[0])!.label,
        exact: true,
      });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(`[data-question="${q.id}"]`).getByRole("status"),
  ).toContainText(q.explanation);
  await expect(page.locator(".academy-stats").nth(0)).toContainText(
    "0Distinct first-exposure answers",
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokerlab-review-v1")!),
    ),
  ).toEqual(review);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokerlab-training-v1")!),
    ),
  ).toEqual(training);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pokerlab-academy-v1")!).priorKeys,
    ),
  ).toContain("price:1/2");
});
