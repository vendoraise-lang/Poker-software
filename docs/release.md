# PokerLab release guide

This release keeps Phases 1–6 and their saved-data schemas. It adds no solver, engine, accounts, payments, paid API, or gambling integration. All play uses fictional chips. Strategy lessons are teaching heuristics, not professional-level certification or externally reviewed optimal play.

## Install and run

Use Node.js **24** (the repository's `.nvmrc`) and npm. Node 24.19.0/npm 11.9.0 were used for release validation.

```sh
npm ci
npm run build
npm run start
```

The app listens on port 3000 by default. Set a different port if needed:

```sh
PORT=8080 npm run start
```

For development use `npm run dev`. No environment variables, API keys, database, account, or paid service are required. Where the default npm cache is not writable, supply a writable cache directory, for example `npm ci --cache /workspace/.npm` in this cloud workspace.

## Deploy

Deploy the repository to a Next.js-compatible Node host, or run the production commands above on a Node server behind your HTTPS reverse proxy. Bind/proxy the selected port; the start script listens on all interfaces. Keep `package.json`, `package-lock.json`, `.next`, `public` if present, and the installed production dependencies together. The application has a dynamic `/practice/[topic]` route: use the Next.js runtime, not a plain static-file host.

Use the same stable origin (scheme, host and port) for everyday use. Browser progress is tied to that origin and browser profile, not the server installation. Before changing domains, devices, ports or clearing browser data, export a backup; import it on the destination and explicitly confirm replacement. Deploying code does not transfer localStorage between origins. A production server build was tested locally; no public deployment was performed during this sprint.

There is no offline service worker. “Local-first” means progress and calculations stay in the browser after the application loads, not that an uncached page always opens without a network connection. JavaScript and Web Worker support are required for the complete experience.

## Beginner quick start

1. Open PokerLab. The **Your first practice session** guide explains the journey and common terms. Choose **Start your first lesson**.
2. In **Academy → Module 1**, try both interactive examples and mark the lessons explored. Open **Assessment**, answer four questions, read each explanation and finish the review. A completed module records activity, not certified mastery.
3. Choose **Play** in the workspace links. Wait for your turn. **Check** passes when no bet is owed; **Call** matches the outstanding bet up to your remaining chips. Following Check/Call reaches a showdown unless another legal action ends the hand. Folding gives up your claim and the remaining simulated players finish their hand.
4. Once the hand finishes, open **Review**, select a highlighted player decision, and examine only what was known then. Equity calculations use unknown opponent hands or your range assumptions, never later private information.
5. Open **Equity**, choose the board royal-flush example and calculate. Three tied players each have 100% tie probability and 33.33% pot equity. Exact/estimated labels and assumptions matter; equity alone does not select the best bet.
6. Open **Train** for focused practice, or return to **Academy** for its recommended lesson. Workspace selections survive reload via the URL. **Dashboard** shows play outcomes and the three original Learn cards; its Academy link opens structured learning evidence separately.
7. In **Train → Data**, export a JSON backup. Import validates first and asks before replacing included sections. Cancel leaves progress unchanged.

## Recovery and compatibility

- Backups version **2, 3, 4 and 5** remain accepted. Export includes version 5 when Academy history exists. Old backups preserve newer sections they omit; import replaces included sections rather than merging them.
- Original game, preflop, postflop, Review and Academy keys keep their existing versions. No history or answer IDs were regraded or migrated away. The release introduces no new persistent key.
- Malformed game or training records no longer get silently replaced by empty fallback state. Postflop, Review and Academy likewise retain damaged records. A warning explains in-memory behavior and backup recovery.
- Prefer a previously exported valid backup. The explicit **Reset saved table** action replaces damaged table data while retaining valid readable statistics and separate training keys. It cannot recover unreadable statistics or reconstruct missing hand histories. If a damaged record matters, retain a copy from browser developer tools before resetting. A normal validated export cannot export malformed sections as a valid backup.
- Saved record snapshots are checked before writes in all learning areas and the game. If another tab changed a record, the stale tab stops saving and warns. Reload to read the newer record. This is conflict detection, not cross-tab synchronization or an atomic database transaction; avoid simultaneous editing of the same learning history.
- Storage denial/quota errors leave new work in memory only and show a warning. In-memory work is not included in exports of persisted progress. Clearing browser storage or using a private profile can remove progress.

## Bugs and release fixes

| Priority | Finding | Resolution |
| --- | --- | --- |
| P0 | Malformed but parseable game statistics could load an empty fallback and be overwritten on hydration. Unsafe integer statistics could also survive a reset through the looser loader. | Validate the original record before enabling writes; use the same strict game-statistics validation for loading and backups; preserve damaged originals until explicit recovery/reset. |
| P0 | Invalid older preflop/daily progress could parse as empty, report storage available, and be automatically saved over. | Share strict training validation with backups. Mark unreadable/invalid records unavailable and block saving while allowing in-memory practice. |
| P0 | Stale game, training, postflop or Review tabs could silently overwrite newer records. | Compare with the last read/written snapshot before persisting; stop writes and explain reload/recovery on conflict. Academy already performed this check. |
| P0/P2 | Worker setup/postMessage failures could leave Equity stuck busy or leak the worker. Worker message-deserialization failures lacked a recovery handler. | Clean up the worker and busy/progress state, reject incomplete results, show an actionable error and allow retry in both Equity and Review. Cancellation remains supported. |
| P1 | Hidden practice-table cards retained a suit-color CSS class even though their visible backs matched. | Remove all suit-color classes while hidden; the beginner journey checks hidden-card markup before play. The local deal engine remains inspectable, so this is information hygiene rather than cryptography. |
| P1 | Original position wording implied a folded button still acts last; outcome-oriented dashboard copy could suggest measured skill. | State “when still in the hand” and label outcomes as practice history. Keep equity/model uncertainty and heuristic disclosures. No mathematical-answer mismatches were found by the independent reference checks. |
| P2 | Beginners had no obvious starting point; Equity was buried in Train; cross-page workspaces and reload destinations were inconsistent. | Add the beginner guide/glossary, six-workspace navigation and query-backed destinations. Keep existing controls and routes. Clarify original Learn progress versus Academy evidence. |
| P2 | Training tabs lacked arrow/Home/End navigation; skip navigation and some focus treatments were missing. | Add a skip link, named landmarks, roving tab focus, card image semantics, visible select/summary focus and reduced-motion rules. |
| P2 | Low-contrast captions/red cards/selected cards and pair cells; empty matrix corner headers; small mobile grid targets. | Correct colors and header text; increase main actions/workspace/grid targets and provide horizontal-scroll/keyboard instructions. |

## Education verification

`tests/release.test.ts` uses independent test-only reference arithmetic, physical two-card enumeration, and five-card ranking comparisons. These are not called by the application and do not create a new production poker engine.

- Independently verifies **all 35 Academy mathematics questions**, all five older odds quizzes, and all five older draw exercises.
- Cross-checks all 14 Academy ranking/texture examples and all 30 postflop fixture made hands.
- Exhaustively enumerates remaining boards for **all five fully specified-hand equity examples**, comparing win, tie, loss, fractional share and outcome counts. The six-player random-hand example is not exhaustively enumerated; existing seeded-simulation/exact-comparison tests remain in place.
- Retains the structural audit of all 159 teaching fixtures, betting/side-pot/turn-order tests, position tests, hidden-information tests, and backup/migration tests.

This is independent reference **code**, not independent human educator review. Preflop baselines, strategic reasoning, wet/dry summaries and learning thresholds remain heuristic and need human review. The assessment bank remains finite; repeated fixtures do not become independent evidence. No proficiency-validation or solver-backed GTO claim is made.

## Accessibility scope and remaining limits

Automated axe-core checks cover WCAG 2 A/AA, WCAG 2.1 AA and best-practice rules on Play, Train, Equity, empty Review, Academy, Dashboard, a focused drill, the range matrix and a completed-hand review decision at mobile and desktop sizes. Keyboard tests cover skip navigation, tabs, focus, matrix movement and primary touch targets. Existing responsive tests include 320–1440-pixel widths.

Automation cannot certify accessibility. Axe checks marked incomplete (including some composite-background contrast and ARIA cases) are retained in test attachments for manual examination. No real screen-reader, switch-device, zoom-to-400%, Safari, Firefox or physical-device accessibility certification was performed. Some secondary legacy controls and dense desktop grids remain smaller than the enlarged primary mobile targets; small type remains in dense technical displays. These are follow-up usability/accessibility tasks, not grounds to claim full WCAG compliance.

## Release checks

Run from a clean install:

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run start
```

In another terminal, while the production server is running:

```sh
npm run test:e2e
```

Playwright reuses the running server, so this verifies production rather than development. It uses system Chromium when available; otherwise first run `npx playwright install chromium`. The accessibility tests resolve the already locked axe-core dependency from the ESLint accessibility toolchain.

### Final verification — 2026-10-24

| Gate | Result |
| --- | --- |
| Clean `npm ci --cache /workspace/.npm` | Passed; 405 packages installed from the lockfile |
| `npm test` | **283 / 283 passed**, 8 files (all previous 265 plus 18 release/regression checks) |
| `npm run lint` | Passed, no warnings or errors |
| `npm run typecheck` | Passed |
| `npm run build` | Passed, including static main/Academy/Review pages and dynamic focused drills |
| `npm run test:e2e` with `npm run start` | **66 / 66 passed**, 2 workers (all previous 50 plus 16 release/accessibility checks) |
| Automated accessibility scans | No reported violations in 18 sampled mobile/desktop scans; incomplete checks retained in attachments |
| Full beginner journey | Passed at 390px and 1440px: open → lessons → assessment → real simulated hand → decision review → review equity → Explorer equity → Train → reload → Dashboard/Academy |
| Visual walkthrough | Inspected production screenshots at 390px and 1440px, no document overflow or visible error messages; existing browser layout checks also pass at 320px, 768px and other widths |

**Verdict: GO for local, play-money educational use.** No known P0/P1 release blockers remain in the tested flows. No public deployment was performed. This verdict does not assert human educator review, professional training validity, full WCAG compliance, or compatibility with untested browsers/devices.

Next maintenance priorities: independent human educator review of strategic fixtures, real assistive-technology and cross-browser testing, and a small beginner usability trial. The clean installation also emitted an ESLint 9 support/deprecation notice; the current lint gate passes, and toolchain lifecycle maintenance should be handled separately without changing released learning data.
