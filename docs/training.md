# Phase 2 teaching model

Phase 2 lives in **Train**, alongside the existing four-seat practice game. The engine in `lib/poker.ts` is unchanged. Training feedback, scores, ranges and scenario selection live in `lib/training/`; training does not retrospectively grade the practice game.

## Assumptions and limits

Scenarios use six seats in preflop order: UTG, HJ, CO, BTN, SB, BB. Blinds are 0.5/1 big blinds, with no antes or rake. Effective stack is stated **before the hand**; invested chips and stack remaining are shown separately. The call amount is the current wager minus the hero's investment. All fixtures have enough chips to call or raise, so Fold, Call and Raise are legal, including a legal limp in an unopened pot. For the 20 BB fixture, Raise means an all-in raise to 20 BB. Other displayed raise totals are illustrative fixed sizes. Scoring evaluates the selected action, not free-form sizing.

There are **15 curated, deterministic fixtures**, not an unlimited random situation generator. Each has a stable ID, level, position, two-card class, stack, prior actions, teaching strength group, preferred line, accepted alternatives and separate explanations for all three actions. Physical cards are deterministic representative suits of the hand class. No opponent cards, made-up equity, EV values or solver outputs are used. Strength groups are teaching labels, not equity estimates.

## Fixture catalogue

| Level | ID                | Spot                              | Preferred / also accepted |
| ----- | ----------------- | --------------------------------- | ------------------------- |
| 1     | `open-utg-aa`     | UTG first in, AA                  | Raise                     |
| 1     | `open-utg-j4o`    | UTG first in, J4o                 | Fold                      |
| 1     | `open-btn-a5s`    | BTN first in, A5s                 | Raise                     |
| 1     | `open-hj-99`      | HJ first in, 99                   | Raise                     |
| 1     | `open-sb-72o`     | SB first in, 72o                  | Fold                      |
| 2     | `defend-bb-kqs`   | BB versus BTN open, KQs           | Call / Raise              |
| 2     | `defend-btn-72o`  | BTN versus UTG open, 72o          | Fold                      |
| 2     | `defend-co-aa`    | CO versus HJ open, AA             | Raise                     |
| 2     | `defend-btn-88`   | BTN versus CO open, 88            | Call / Raise              |
| 2     | `defend-sb-j3o`   | SB versus HJ open, J3o            | Fold                      |
| 3     | `short-bb-ako`    | BB versus BTN open, AKo, 20 BB    | Raise                     |
| 3     | `defend-btn-aqs`  | BTN versus UTG open, AQs          | Call / Raise              |
| 3     | `defend-bb-83o`   | BB versus UTG open, 83o           | Fold                      |
| 3     | `threebet-co-qq`  | CO open versus BTN three-bet, QQ  | Raise / Call              |
| 3     | `threebet-co-a9o` | CO open versus BTN three-bet, A9o | Fold                      |

All ordinary opens face 2.5 BB. Three-bet fixtures face 9 BB after the hero opened to 2.5 BB. Six-seat prior action sequences skip folded players when action returns to the hero. Explanations qualify context-dependent alternatives rather than claiming one universally profitable action.

## Matrix and opening samples

The grid orders ranks A through 2 on both axes. Pairs are diagonal, suited classes above the diagonal and offsuit classes below. Every class roundtrips to representative physical cards. Classes are not equally weighted: 13 pairs × 6, 78 suited classes × 4, and 78 offsuit classes × 12 sum to 1,326 combinations.

`OPENING_RANGES` contains explicit, simplified approximately 100 BB raise-first-in teaching samples. UTG ⊂ HJ ⊂ CO ⊂ BTN. SB deliberately reuses the conservative CO sample in a raise-or-fold lesson; it does not teach small-blind limping. BB has no unopened raise-first-in range: folded-to BB wins the blinds, while a small-blind limp or earlier raise is a different spot. Do not invent an opening chart for that seat.

These are not exact GTO ranges and are not intended for other stack depths, facing a raise, tournament ICM, rake or opponent-specific adjustments. The matrix's combination count is range coverage, not an equity or profitability estimate. Select a cell with a pointer, or use arrow keys after focusing the selected cell. Narrow screens scroll the grid inside its own panel.

## Pot odds

Every quiz is heads-up with a single new opponent bet and no rake. The stated original pot excludes that bet:

```
pot now = original pot + opponent bet
call = opponent bet
final pot = pot now + call
break-even share = call / final pot
```

For example, 50 into 100 gives a pot now of 150, a final pot of 200, and a 25% break-even share. Pot-sized 100 into 100 gives 100/300, approximately 33.3%. The quiz accepts its rounded option, not a fabricated precise equity claim.

This is a break-even equity threshold only with no subsequent betting or costs. Calculating the price does not estimate the hand's equity or account for realization, domination, future betting or the opponent's range. The warning remains visible before and after answering.

## Scoring, progression and daily plans

One submitted answer records one attempt. A preferred line and any explicitly accepted alternative earn the same credit. Other legal actions receive context-specific feedback. Accuracy equals accepted attempts divided by submitted attempts. Repeated practice counts; accuracy does not measure profitability, skill mastery or live-game decision quality.

Difficulty is learner-controlled. The suggested level advances after five attempts at level 1 and then five at level 2, regardless of scores. Mistake analysis groups incorrect **decision** attempts by position, teaching hand-strength group and chosen action. Each error appears once per dimension; these counts should not be summed as independent errors. Pot-odds errors are tracked separately by topic. The recommendation selects the lowest-accuracy topic with recorded errors, breaking ties in the documented topic order (opening, defending, reraising, pot odds); no errors defaults to foundations.

Daily plans hash the local device date string `YYYY-MM-DD` using a 32-bit rolling hash (`hash = hash * 31 + character`, unsigned). Each five-fixture level pool starts at `hash % pool.length`; the plan selects two adjacent level-1 fixtures, two adjacent level-2 fixtures and one level-3 stretch fixture. Same date and fixture version gives the same plan. For `2026-10-24`, the IDs are `open-utg-aa`, `open-utg-j4o`, `defend-bb-kqs`, `defend-btn-72o`, `short-bb-ako`.

Sessions suggest 3 minutes of lessons, 5 minutes for five scenarios and 2 minutes of review. Timing is self-paced. A daily stretch fixture may appear before the suggested practice level. Unfinished sessions resume from the next unanswered fixture, even on a later day. Completion requires all five answers and the explicit Complete session action; repeated completion is idempotent. Replaying a date is allowed. Missed days never decrement sessions, scores or levels.

## Persistence

`pokerlab-training-v1` is independent of the Phase 1 `pokerlab-progress` key. It stores versioned attempts (fixture ID and choice), completed session summaries, and the current daily plan and answer IDs. Scores are derived from known fixture definitions rather than trusting stored correctness claims. Changing the meaning of existing fixture IDs would change historic scoring: add versioned IDs or migrate the schema when revising substantive strategy definitions.

Loading checks the schema, known targets, choices, dates, unique IDs and daily answer links. Invalid/unsupported JSON falls back safely to an empty training record. Storage read/write failures display a warning and let practice continue in memory. History remains local and is not synchronized between tabs, devices or accounts. Storage capacity is browser-dependent; no cloud service is required. Phase 3 adds versioned export/import through Train → Data; see [the Phase 3 contract](postflop.md).

## Validation

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`. Tests cover all 169 mappings and 1,326 combinations; range membership; fixture legality, action ordering and alternatives; pot-odds denominators and rounded answers; scoring, categories and progression; local storage failures and corrupt records; deterministic daily plans and idempotent session completion. Browser coverage includes Phase 1 play, every new tool, daily resume across reload, independent storage, recommendations, matrix keyboard navigation and narrow layouts.
