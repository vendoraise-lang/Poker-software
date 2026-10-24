# Phase 4: Equity & Probability Lab

## User workflow

Open **Train → Equity**. Explorer accepts a two-card hero hand, zero/three/four/five board cards, and one to five opponents (2–6 total players). Each opponent has a fully known two-card hand or a uniform random legal hand. Card notation and a 52-card picker edit the same inputs. All exposed cards are checked together; duplicate or impossible states are rejected before computation. Partly edited boards with one or two cards cannot be calculated.

Automatic mode selects exact enumeration when the outcome space is small enough. Otherwise a seeded Monte Carlo calculation runs. Results include every player's outright-win, tied-for-best and loss probabilities and their fractional pot equity. The hero has a win/tie/loss visualization. Estimates show the actual sample count, seed, possible outcome count and uncertainty intervals. Exact results explicitly say enumeration and display the enumerated outcome count. Percentages are rounded.

Pin a completed result, edit the turn/river or other assumptions, and calculate again to compare. Changed inputs mark an existing result as previous/stale, never as a result for the edited cards. Differences involving Monte Carlo can be sampling noise; comparisons do not establish strategic causality. Cancel stops the worker. Inputs are locked during a calculation; reading the page and cancelling remain available.

Six teaching examples include a three-way royal-flush split, an overpair versus a set in a three-way pot, a three-way combination draw, and aces versus five uniformly random hands. These are authored and checked in code/tests for card and mathematical consistency, not externally expert-reviewed strategy recommendations. Each explains the conditioning assumptions and why multiway decisions require more than equity.

The outs trainer has five counting exercises: flush, open-ended, single-gutshot, combination and double-gutshot draws. Quiz feedback is session-only. Explorer state, results and pinned comparisons are also temporary. No Phase 1/2/3 storage keys or backup versions change; existing saved hands, replay histories and training progress remain intact.

## Architecture

- `lib/equity/engine.ts`: pure validation, combinatorial counts, uniform sampling, exhaustive enumeration, showdown accounting, uncertainty and batched execution. No UI, storage, network or game-state mutation.
- `lib/equity/draws.ts`: deterministic pattern-completion candidates, overlap, conditional river winner checks, and fixed-set hit probabilities.
- `lib/equity/examples.ts`: authored inputs and educational context, with stable IDs for tests.
- `workers/equity.worker.ts`: message protocol and off-main-thread runner.
- `components/EquityLab.tsx`: explorer, picker, results, comparisons, outs quizzes and multiway lessons. The existing verified `evaluate` and `compare` from `lib/poker.ts` are reused unchanged.

`createEquityJob(input)` creates a validated job, `step(batch)` advances it, and `result()` only succeeds after completion. `runEquity(input, options)` adds cooperative yields, progress callbacks and `AbortSignal` cancellation. Chunk size and scheduling do not affect seeded results. UI runs use a module Web Worker via `new Worker(new URL(..., import.meta.url))`. Each run has an ID; stale messages cannot replace a newer result. Cancel and unmount terminate the worker immediately. A browser without working Web Workers gets an explicit error rather than a heavy main-thread fallback.

## Mathematical model

Everyone reaches showdown, every player has an equal claim to one pot, and the best five cards of seven determine winners. No folds, betting, stack constraints, side pots, rake or future decisions are modeled by the lab. The practice engine's existing side-pot/betting rules remain separate and unchanged. Computed normalized expected pot share is equity, not strategic/net monetary EV.

For outcome `d`, let `W(d)` be the set of players tied for the best hand. Player `i` receives:

```
share_i(d) = 1 / |W(d)|  if i is in W(d), otherwise 0
```

An outright win means share = 1. A tie means 0 < share < 1; it is counted only for players tied for best, not losing players whose opponents happen to tie. Loss means share = 0. Pot equity is the average share. Thus a three-way board royal gives each player win = 0, tie = 1, loss = 0 and equity = 1/3. Win + tie + loss equals 1 for each player; all players' pot equities sum to 1, subject to floating-point rounding.

Known opponent cards are removed from the pool **before** any board or unknown-hand allocation. Random opponents are uniform over legal two-card combinations conditional on all visible cards; their hands are jointly dependent through a shared deck. They are not opening ranges, calling ranges or independently sampled hands allowed to collide.

### Exact enumeration

Let `N` be unseen cards after removing hero, known board and all known opponents. Let `b = 5 - board.length`, and `u` be the number of unknown opponents. The count is an exact BigInt:

```
C(N, b) × C(N-b, 2) × C(N-b-2, 2) × ... × C(N-b-2(u-1), 2)
```

Board additions and each hole-card pair are unordered; opponent seats are labeled. Every such allocation has equal multiplicity in an ordered physical deal: `b! × (2!)^u`. Therefore uniform enumeration of these allocations gives the correct showdown distribution. The order of unknown future board cards does not affect showdown equity because this model includes no intervening bets or folds. Unobserved burn cards are integrated out; they do not change this conditional uniform model.

Recursive combination generators enumerate each allocation once. Exact mode requires at most **50,000 outcomes** and at most **120,000 player evaluations** (outcomes × total players). Automatic mode switches to Monte Carlo outside either cap. Explicitly requested oversized exact work is rejected, not silently relabeled.

Examples: two known hands plus a flop leave 45 unseen cards, so C(45,2) = 990 runouts. Two known hands plus a turn leave 44 possible rivers. A known hero and a random opponent on the river have C(45,2) = 990 possible opponent hands. A random opponent on the turn has 46 × C(45,2) = 45,540 allocations. Large counts are displayed as decimal strings, without unsafe Number rounding.

### Monte Carlo sampling

A reproducible xoshiro128** generator is initialized by a 32-bit SplitMix-style expansion of the supplied unsigned 32-bit seed. It is pseudorandom and not cryptographic. A bounded integer draw rejects only values outside the largest multiple of its bound below 2^32, removing modulo bias. This RNG-level rejection is distinct from rejecting invalid poker deals.

Each trial starts with the same valid unseen pool. A partial Fisher–Yates shuffle selects exactly `b + 2u` distinct cards without replacement: first the missing board, then unknown hands in seat order. No trial is formed by repeatedly guessing hands and rejecting card collisions. Under ideal uniform integer draws, every ordered selected prefix is equally likely; unordered allocations consequently have the same constant multiplicity as exact enumeration. Trials sample with replacement from the legal outcome space, so different trials can repeat a deal.

Input copies prevent mutations to caller-owned card arrays. Identical cards, seat order, seed, sample count and method reproduce identical results regardless of chunk size. This reproducibility does not make a sample exact.

The Monte Carlo cap is **50,000 trials** and **120,000 player evaluations**. In six-player work, at most 20,000 trials are allowed. Over-budget user requests are rejected with the appropriate limit; they are not silently truncated. Input sample count must be an integer 1–50,000 even if automatic mode ultimately selects exact enumeration. Explorer offers 1,000/5,000/10,000/20,000/50,000 trials with a default of 5,000.

## Uncertainty

Only completed Monte Carlo results get nominal 95% sampling uncertainty intervals:

- Outright win, tie and loss use Wilson score intervals (`z = 1.959963984540054`). The hero's are displayed explicitly.
- Fractional pot share uses a conservative two-sided Hoeffding bound for observations in [0,1]: `epsilon = sqrt(log(2 / 0.05) / (2n))`, clipped around the sample mean to [0,1]. Every player's equity interval is shown in the table.

These are individual intervals, not a simultaneous/joint guarantee. They assume the usual independent uniform-trial model approximated by the PRNG. A fixed seed gives a deterministic estimate, not an independently verifiable physical confidence experiment. Intervals concern sampling error under the supplied cards/model; they do not account for an inaccurate assumed opponent distribution or unknown strategic behavior. Zero observed rare events does not establish probability zero. The bounded-share interval deliberately remains nonzero-width when an observed sample has zero variance.

Exact enumeration has no Monte Carlo error and returns point intervals internally. It is exact **conditional on the specified cards and uniform unknown-hand model**, not an exact strategic forecast. Output percentages still involve decimal rounding and floating-point arithmetic.

Cancellation returns no partial result. In particular, an enumerated prefix is not a random sample and cannot be labeled an estimate or exact equity. Worker progress only reports completed/target work, never partial-prefix probabilities. CPU work is off the main thread, batched (50 trials by default, maximum 500 per step) and yields so progress messages and cooperative cancellations can run. The UI additionally terminates the worker to cancel immediately.

## Outs and probability teaching

An out candidate here means a distinct available next card completing a flush and/or straight that is not already made. It does not include every pair/overcard improvement. Candidates are determined from actual cards and the evaluator's existing texture helpers, not from language-model guesses.

Nine flush candidates plus eight straight candidates with two overlapping physical cards give 15, not 17. Open-ended requires four consecutive ranks with two available end ranks; two separate inside completion ranks are a double gutshot. Ace-low windows are handled. Four visible suited cards are not a made flush, and a backdoor draw is not an immediate one-card flush draw.

On the flop, every pattern candidate remains uncertain as a winning out because another river can change the outcome. On the turn, a candidate can be certified as an outright showdown winner **only when every opponent hand is specified**. The trainer's known example has hero As Qs, board Js 7s 2d 9c and opponent 9h 9d. Nine spades complete the flush, but 2s gives the opponent a full house and 9s gives quads. Seven cards actually win the specified river showdown, yielding exact win/equity 7/44. If opponents are unknown, none is certified clean. Tying or losing completions are not called clean wins.

For a fixed identified set of `o` cards among `N` unseen cards:

```
P(at least one next card in set) = o/N
P(at least one in next two) = 1 - (N-o)(N-o-1) / (N(N-1))
```

These are exact probabilities of seeing that fixed set under a uniform remaining deck, not automatic probabilities of winning or even every possible way of improving. They omit backdoor paths/new outs and do not model paying to see another card. Rule of 2 (one card: approximately `2 × outs` percent) and Rule of 4 (two cards: approximately `4 × outs` percent) are explicitly rough approximations, less reliable for large counts. The two-card shortcut assumes both cards are seen. No hit percentage is presented as a recommended action.

## Validation and limits

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`. New tests cover card/deck uniqueness, input boundaries, bounded sampling, counts in BigInt, exact known win/loss and fractional ties for 2–6 players, unknown-hand enumeration, seed/batch reproducibility, comparison with the exact 7/44 case, conservation, cancellation and incomplete-job rejection, uncertainty extremes, draw overlap, clean/dirty candidates, worker use, picker interactions, runout comparison, six-player completion, estimates, responsive 320–1440px layouts, and earlier-phase regressions.

The original Phase 4 Explorer keeps known/uniform opponents. Phase 5 adds weighted joint-range support through the completed-hand Review Studio; see [the validated range model](review.md). It does not silently substitute teaching charts for actual opponent ranges. Other limits: no partial known opponent hands, dead-card entry, side-pot equity, future folding/betting, net EV, GTO solver, paid APIs or gambling integrations. Multiway examples are authored and mathematically tested; no external human expert review is claimed. Current quiz/explorer activity is temporary and is not added to long-term progress or exports.
