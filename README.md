# PokerLab

A local-first, four-seat Texas Hold’em training room built with Next.js, TypeScript, React and Tailwind CSS. All chips are fictional. No accounts, paid APIs, payments, or real-money features.

See the [release guide](docs/release.md) for installation/deployment, the beginner quick start, recovery, verified fixes, test results and known limits. No independent human educator review or professional training validity is claimed.

## Vercel deployment

Import this repository into a personal Vercel **Hobby (free)** project using the Next.js preset, repository root, Node.js 24.x, and `npm run build`. No environment variables or paid add-ons are needed. Follow [the Vercel import and production verification guide](docs/vercel.md). A deployed URL must be verified separately from the local release checks.

## Run

Requires Node.js 20.9+ (validated with Node 24) and npm.

```sh
npm ci
npm run dev
```

Open the development server in your browser. `npm run build && npm start` runs the production app. No environment variables or credentials are required. If your machine restricts the default npm cache, use `npm ci --cache /workspace/.npm`.

## Play and learn

- You start with 1,000 chips against Maya (tight-passive), Atlas (loose-aggressive), and Theo (tight-aggressive). Blinds are 10/20.
- Wait for your turn, then fold, check/call, or choose a bet/raise total with the slider. Half-pot, pot, and all-in presets adjust the slider; the bet/raise button submits it. Sizes are clamped to your legal range. Short all-ins are supported.
- Dealer and blinds rotate, busted opponents sit out, and heads-up blind/action order is supported. Next hand carries stacks forward. New session is available when you bust or only one player has chips.
- The companion explains your position, options, hand strength, and completed hand. The Learn area contains positions, action rules and the hand hierarchy. Mark lessons explored to record training progress.
- Dashboard tracks completed hands, hands with a positive net chip result, win rate, the latest 200 human decisions, and explored lessons. Split pots with no net profit are not counted as wins.

## Data and reproducibility

Progress is stored under `pokerlab-progress` in browser localStorage, with version and shape validation. It never leaves your device. Storage denial shows an in-app notice. Clearing browser data clears progress. Unfinished hands and chip stacks now resume on reload through validated action journals; historical progress is retained. Tabs do not synchronize concurrently. Stale-record checks stop writes if another tab changed saved progress; reload to load that newer record.

A session starts at seed 2026; each subsequent hand increments the seed. This intentionally makes practice repeatable. `newHand(seed, previous?)`, `act(state, action, raiseTo?)`, and `botAction(state)` are deterministic. Actions clone state before mutation and reject illegal actions and sizes. Cards use ranks 2–14 and suits spades/hearts/diamonds/clubs (0–3).

## Architecture

- `lib/poker.ts`: seeded Fisher–Yates shuffle, best-five evaluation, betting state machine, side-pot settlement, positions and profile-based opponents. No React or browser dependencies.
- `lib/progress.ts`: versioned local progress types and safe loading.
- `components/Card.tsx`, `components/PlayerSeat.tsx`: reusable card and seat presentation.
- `app/page.tsx`: table controls, bot scheduling, training content and dashboard. Bot turns pause briefly so actions are readable.
- `app/globals.css`: responsive dark table, controls, training and dashboard styles using Tailwind's stylesheet pipeline.

The evaluator compares category followed by ordered kickers, checks every five-card subset of up to seven cards, supports ace-low straights, and ignores unused cards for ties. Settlement constructs contribution-level side pots, excludes folded hands, returns uncontested excess, and distributes odd chips clockwise left of the dealer. Short all-in raises do not individually reopen an earlier wager; cumulative increases of a full raise do. Bots use only their own cards and the public board, with profile-specific aggression and entry thresholds.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Unit tests cover every hand category, kickers, ties, wheel/royal straights, deck uniqueness, immutable transitions, legal actions and sizes, turn order, blinds, heads-up play, all-ins, cumulative reopening, side pots, odd chips, chip conservation, multi-hand sessions and corrupted/unavailable local storage. Browser tests play a complete hand, verify decision and lesson persistence across reload, exercise folding and hints on mobile, and check desktop/mobile overflow.

Playwright uses `/usr/bin/chromium` when available in this cloud environment. Otherwise it uses its managed Chromium; run `npx playwright install chromium` once. It starts the dev server automatically unless one is already running.

## Current limits

Opponents are transparent heuristic training profiles, not a poker solver. Game feedback teaches fundamentals and does not grade decisions against optimal play. The separate Phase 4 lab calculates conditional showdown equity, not strategic EV. There is no multiplayer, cloud sync, account system, tournament structure, real-money gambling, or full GTO solver. The app works locally after loading; this phase does not install an offline service worker.

## Phase 2: Beginner Decision Trainer

Open **Train** in the workspace navigation for preflop decisions, the 169-hand range matrix, pot-odds quizzes, mistake analysis and a guided daily session. Fifteen documented 6-max fixtures support three learning levels. Explanations accept reasonable alternatives and label opening charts as simplified teaching approximations. The daily routine includes lessons, five decisions and a review, with local resume and no missed-day penalties.

Training uses a separate local storage key and does not change the Phase 1 engine or historic game progress. See [the teaching model and fixture catalogue](docs/training.md) for assumptions, scoring, deterministic selection, persistence, validation and limits. Phase 2 does not infer equity or EV. The separate Phase 4 lab now calculates conditional showdown equity.

## Phase 3: Postflop Intelligence

**Train → Postflop** adds 30 curated flop/turn/river decisions, adaptive retrieval and previously missed review. **Texture** analyzes actual card patterns and separates possible draws from made hands. **Data** exports/imports validated progress with an explicit overwrite confirmation. The practice table resumes unfinished hands and replays up to 20 newly recorded completed hands with staged information and hidden opponents.

See [Phase 3 architecture and data contracts](docs/postflop.md) for fixture assumptions, texture rules, retrieval evidence, replay privacy, persistence and backup versions. The original engine and Phase 2 storage remain compatible. Only play chips are used.

## Phase 4: Equity & Probability Lab

**Train → Equity** adds a 2–6 player probability explorer with a 52-card picker, known/random opponents, automatic exact enumeration or seeded Monte Carlo, visible uncertainty, Web Worker progress/cancellation, pinned runout comparisons, outs exercises and multiway lessons. It reuses the verified evaluator. Calculations and quiz activity are temporary; no existing progress or backup format is changed.

See [the probability engine architecture and mathematical assumptions](docs/equity.md). The base Explorer retains known/uniform opponents; Phase 5 adds validated weighted ranges in the retrospective Review Studio. No paid API, strategic EV, solver-backed GTO or real-money feature is added.

## Phase 5: Intelligent Hand Review

Open **Review** in the practice-room navigation or visit `/review`. Review completed simulated hands street by street, select each player decision, inspect factual prices and public history, define weighted opponent-range hypotheses, and calculate equity with only then-known cards. Documented heuristic prompts are separated from facts and user reflections. Topic links lead to the existing practice exercises.

The new `pokerlab-review-v1` key adds local observations/range defaults; backups add version 4 while keeping version 2/3 imports compatible. Existing game and training histories are preserved. See [review architecture, range mathematics and limitations](docs/review.md) and [measured performance](docs/phase5-performance.json). Run `npm run bench:review` to repeat the measurements.

## Phase 6: Poker Academy & Skill Assessment

Open **Academy** from the practice-room navigation. Seven structured modules cover rules, position, pot odds/equity, postflop reasoning, textures/draws, ranges/blockers, and hand review/uncertainty. Each includes objectives, interactive visual lessons, practice and a resumable four-question assessment. A learning dashboard separates facts/maths from conditional strategy reasoning, recommends study, and shows distinct-context evidence and recent review reflections. Completion records activity rather than mastery; no validated numerical player rating is claimed.

The separate `pokerlab-academy-v1` event history preserves Phases 1–5. Version 5 backups include Academy history; versions 2–4 still import while preserving omitted newer sections. Repeated and already-exposed assessment contexts remain study material without increasing independent evidence. The bank is finite: 14 concepts, 14 practice examples and 84 assessment fixtures.

See [Academy architecture, curriculum and compatibility](docs/academy.md) and [educational audit findings](docs/educational-audit.md). Strategic material remains heuristic and awaits external educator review. Existing game, review and equity engines are reused unchanged.

## Release readiness

Final release checks passed from a clean installation: **283 unit tests**, **66 production-browser tests**, lint, type checking and production build. The complete beginner journey passes at desktop and mobile sizes. Corrupted-save overwrites, stale-tab writes, failed equity worker recovery, hidden-card suit-color markup, navigation/reload consistency, keyboard focus and contrast issues were addressed. See [the release guide and GO verdict](docs/release.md) for evidence and remaining limitations.
