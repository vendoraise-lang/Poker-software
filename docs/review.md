# Phase 5: Intelligent Hand Review

## Implemented surfaces

`/review` is a dedicated retrospective studio linked from the practice-room navigation. It reads the up-to-20 completed simulation journals already retained by Phase 3. It provides public street playback, explicit buttons for every hero action, and a decision panel with position, remaining/effective-behind stacks, current pot, legal actions, recorded commitment, and action history. Streets that were never dealt remain unavailable. An unfinished journal is never treated as completed, and aggregate-only old statistics are not converted into invented hands. Individual invalid entries can be skipped while preserving valid recorded hands; the source data is not rewritten by the studio.

Facts, teaching prompts, personal reflections, range assumptions and equity estimates are separate UI sections. The studio is for completed PokerLab simulations only. There is no live hand entry, OCR, poker-site integration, live advice feed, automated betting, paid API, financial EV output or solver/GTO claim.

## Public-information boundary

`lib/review/model.ts` restores a journal with the existing engine, aligns hero turns with the existing public replay frames, and returns projected `DecisionPoint` objects. The projection includes hero cards, then-known community cards, public stacks/bets/folds, public profile labels and pre-action logs. It excludes the deck, origin/deal seed, actual opponent hole cards and later board/actions. The selected hero action is shown as the historical action being reviewed, not fed into showdown simulation as an optimal-choice label.

`decisionEquity` accepts only that public projection. All live opponents are unknown hands or user-defined ranges; folded players are removed as participants but their hidden cards are not treated as known dead cards. Simulation seed 2026 is unrelated to the recorded deal seed. The UI cannot automatically populate actual opponent cards. A contested showdown can reveal eligible hands in playback; choosing an earlier frame conceals them again. This is local application information hygiene rather than cryptography: PokerLab's deterministic deal engine is locally available.

Earlier-street comparisons offer only earlier hero decision points with shorter boards. Each calculation uses its own earlier participant list and public board, never the later board or later fold information. A difference can reflect changing participants, board conditioning, user range assumptions and Monte Carlo noise. All equity assumes one equal pot and no further betting, not the contribution structure of the practice hand.

## Factual calculations

Immediate call cost comes from the engine's legal-action calculation. If hero's total contribution after a call is `H`, the hero-eligible post-call pot is `sum(min(contribution_i, H))`, including the hero's call and folded contributions. The snapshot break-even share is call cost divided by that hero-eligible pot. This excludes unreachable upper contribution layers, but is not a full strategic side-pot equity calculation. Remaining opponents may act or raise, so the displayed price is not guaranteed to remain the final price.

Effective behind is explicitly the smaller of hero's remaining stack and the deepest live opponent's remaining stack; committed chips are excluded. The per-player playback also shows each opponent's remaining stack. A recorded raise shows its total and additional hero commitment rather than incorrectly treating a raise-to total as a new pot-sized bet.

## Explicit teaching rules

Rules only inspect the projected decision, never results or hidden cards:

| Rule    | Trigger                                                                                              | Classification and purpose                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PRICE-1 | An immediate call costs chips                                                                        | Factual pot-price reminder; no recommended action                                                                             |
| OPEN-1  | Hero folds AA preflop                                                                                | Heuristic prompt under the ordinary play-chip, no-ICM model                                                                   |
| CALL-1  | Postflop call, high card, immediate share price at least 1/3, no immediate flush/straight completion | Heuristic prompt to explain a costly high-card call; bluff-catching alternatives remain possible                              |
| RIVER-1 | River call with high card                                                                            | Factual reminder that no future drawing card exists; not an assertion that a high-card call cannot beat a bluff               |
| VALUE-1 | Postflop bet/raise with one pair                                                                     | Heuristic prompt to name worse callers or better folding hands; thin value, protection, checking and bluffs may be defensible |
| SIZE-1  | Fresh bet at least the current pot                                                                   | Heuristic sizing prompt; this threshold is not an optimal-sizing recommendation                                               |
| DRAW-1  | Flop/turn has a known immediate flush draw or one-card straight completion                           | Factual draw/made-hand distinction with redraw and overlap cautions                                                           |

No fired rule proves a numerical strategic mistake. No missing rule proves optimal play. The system identifies concepts worth reviewing and gives transparent conditional reasons. It cannot infer the player's intention or an opponent's actual betting range from a profile label.

## Weighted range model and mathematics

`lib/equity/ranges.ts` defines version-1 ranges as `{version:1, weights:{AA:100, AKs:50, ...}}`. Every positive value is an integer relative weight 1–100 per physical combination; omitted/zero classes are excluded. Class weights need not sum to 100. Pairs expand to 6 combos, suited classes to 4 and offsuit to 12 before blockers. Hero, current board and any explicitly known opponent cards are removed first. Each legal combo is normalized by total remaining per-seat raw mass. A class's resulting mass depends on its surviving combination count, not an equal weighting of 169 boxes.

The 169-cell builder supports pointer selection, arrow-key movement and Enter/Space activation. It assigns a weight brush, shows surviving combos and marginal mass, and allows explicit uniform hands or a clearly labeled Phase 2 example opening sample as a starting hypothesis. This sample is not automatically a postflop continuing range. Applied models are saved per opponent seat as personal defaults. They do not update automatically from future actions or actual hidden cards; users must reconsider assumptions at each point.

For unknown seats with hands `h_i`, the supported joint assignment distribution is:

```
P(h_1, ..., h_u | fixed cards, no shared cards)
  = product(w_i(h_i)) / sum_over_compatible_assignments(product(w_i))
```

Unknown uniform seats have constant per-combo weight 1. Known hands cannot simultaneously have an assigned range. Given a compatible assignment, unknown board additions are uniform from remaining cards. Every assignment leaves the same number of cards, so its board-completion count is constant.

### Exact route

A bounded compatibility DFS collects all supported joint assignments when practical. For each assignment it enumerates all remaining unordered board completions. Each deal contributes its raw product of range weights to the denominator and that weight times each showdown share to the numerator. Crucially, weights are **not renormalized separately for each future board**. Complete exact enumeration is selected only within Phase 4's 50,000-outcome and 120,000-player-evaluation caps; otherwise automatic mode selects Monte Carlo. Exact output counts supported allocations, not equally weighted allocations.

### Monte Carlo route

Each unknown seat independently proposes a physical combo using its fixed-card-blocker-normalized weights. If any two proposed hands collide, the **entire joint proposal is discarded**. An accepted assignment therefore has probability proportional to the product of its raw weights, conditioned on compatibility. Future board cards are then drawn without replacement. Accepted samples each count once; their weights are not applied a second time.

This whole-assignment rejection is intentionally different from the biased method of keeping an early hand and renormalizing later seats around it. Early rejection upon a collision is an optimization equivalent to rejecting the entire independent proposal, not a sequential fallback. The xoshiro bounded-integer sampler was extended to bounds up to 2^32 so integer range masses can be sampled without modulo bias. Standard Phase 4 inputs without ranges retain their existing algorithm and seeded results.

Compatibility planning is capped at 100,000 DFS nodes. Each accepted sample is allowed up to 256 whole-proposal attempts; the job is capped at 100,000 proposals overall. Individually empty ranges and proven zero joint support are rejected. If budget exhaustion prevents establishing compatibility or producing samples, an explicit error is returned; the app never substitutes uniform cards, a sequentially biased sampler, or a partial result. Some feasible but pathological heavily overlapping ranges may therefore require simplification. Unknown weighted support counts may be labeled capped/unavailable rather than fabricated.

Exact weighted results have no sampling error conditional on the range model. Completed Monte Carlo retains Phase 4's Wilson intervals for outcome events and a conservative 95% Hoeffding interval for fractional pot share. These concern sampling uncertainty, not whether the user's assumed ranges are correct. Computation runs in the existing Web Worker and is cancellable; review changes unmount/cancel old jobs, and changed assumptions mark results stale.

### Independently countable validation case

Hero Qh Qd, board Ah 2c 3d 4h 9s. Opponent 1 weights AA:1, KK:1; opponent 2 AA:1, KK:3. After blockers, each seat has 3 AA combos and 6 KK combos. Both opponents cannot hold AA (only three aces remain):

- AA / KK: 18 allocations × weight 3 = mass 54, opponent 1 wins.
- KK / AA: 18 allocations × weight 1 = mass 18, opponent 2 wins.
- KK / KK: 6 disjoint allocations × weight 3 = mass 18, split evenly.

Total mass 90 over 42 supported allocations. Hero equity is 0; opponent equities are (54+9)/90 = 0.7 and (18+9)/90 = 0.3. Naive early-seat sampling with later-seat renormalization gives a different, biased 0.5/0.5 result. Exact and seeded Monte Carlo tests explicitly exercise this distinction.

## Personalized evidence, without fabricated mastery

Review reflections are explicit choices: Not assessed, Needs practice, or I can explain it. Unassessed topics are not recorded as understood. Heuristic prompts may suggest practice; the user can change or remove that suggestion. The record key is the full canonical public decision context plus topic. It includes public opponent stacks but excludes the selected action, so taking a different line in an otherwise identical situation does not manufacture a new independent scenario. Reopening an identical decision updates its resolution but does not create another independent context. Up to 2,000 observations are accepted, with errors surfaced rather than silently deleting old records.

Personal trend compares first self-assessments from early versus recent **distinct contexts**, only after at least four contexts. It is labeled self-report, not an objective skill grade. Separately, the studio reads existing practice evidence without modifying those histories: Phase 2 counts the first answer per distinct fixture for opening/pot-odds topics; Phase 3 uses its existing latest first-of-day retrieval per distinct exercise. Repeated identical scenarios do not increase distinct coverage. Neither measure proves strategic mastery.

`/practice/[topic]` links to the existing relevant preflop, pot-odds or postflop exercises with the topic preselected. Completed practice continues using the original training storage and scoring rules. No existing historical attempt is retroactively relabeled or deleted.

## Storage and compatible backups

`pokerlab-review-v1` is a new independent version-1 key with validated observations and three opponent-seat range defaults. Existing Phase 1–4 keys and the version-1 journal format are unchanged. Missing new data initializes an empty review collection. Invalid review data is left untouched and the studio can continue in memory with a warning; quota/storage failures are reported. Unsupported versions are not silently migrated.

Backup version 4 adds a required validated `review` section. Exports remain version 3 when no Review key exists; opening the studio normally creates the new key and enables version-4 exports. Versions 2 and 3 remain importable: missing newer sections preserve existing newer keys. Version 2 also retains Phase 3 data as before. Validation happens before all writes; malformed observations, contexts, dates, duplicate context/topic keys or invalid weights reject the file. The existing explicit overwrite confirmation and best-effort multi-key rollback remain. This is an additive schema migration, not an overwrite of old histories.

Old hands containing only aggregate statistics, truncated journals, or unfinished hands are not invented or used for live analysis. Replay retention remains twenty completed hands. Review context observations can remain after an old journal rotates out. Backups remain browser-local JSON; there is no cross-tab conflict resolution or cloud sync.

## Validation and measured performance

Run the complete checks:

```
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run bench:review
```

The performance command is a separate one-test measurement harness, not part of the main unit-test count. It writes `docs/phase5-performance.json` and uses five measured runs after one warm-up. Values include validation and assertions and are Node synchronous-batch wall-clock measurements, not Web Worker/UI timings. The report records CPU, logical CPU count, Node version and memory. Browser tests separately log complete Worker round-trip times including startup, cooperative yields, rendering and test-observation latency; those values vary with build mode and load.

Current saved Node measurements are in [phase5-performance.json](phase5-performance.json); the single observed production-browser round trips are in [phase5-browser-performance.json](phase5-browser-performance.json). They are observations on this cloud machine, not latency guarantees for phones or other devices. No tests rely on fragile timing thresholds.

Remaining limits: heuristic review is not optimal-action grading; no numerical EV or GTO results; independent range priors are conditioned on shared-card legality but are not inferred Bayesian action-conditioned ranges; only the existing four-seat simulated-hand format is reviewed; review equity still assumes an equal single pot rather than actual side-pot ownership. Extremely overlapping feasible ranges can hit rejection/planning caps. New review data is local with no concurrent-tab merging.

Recommended priorities: independent poker-educator review of rule wording and fixtures; richer cross-scenario concept checks that distinguish self-report from demonstrated transfer; contribution-aware side-pot equity; validated action-conditioned range models; browser/mobile accessibility and performance audits; and explicit conflict-safe backup merging. Avoid live assistance or integration with gambling sites.
