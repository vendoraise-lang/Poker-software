# Phase 3: Postflop Intelligence

## Where to find it

The Train workspace adds **Postflop**, **Texture** and **Data** alongside all Phase 2 tools. The practice table now resumes saved hands and includes **Hand replay** below the action area. No paid services, accounts, real money, solver, invented EV or hand-equity estimates are used.

## Thirty teaching fixtures

`lib/postflop/scenarios.ts` contains ten authored flop, ten turn and ten river situations. All have unique versioned IDs, two hole cards, a disjoint three-to-five-card board, position, remaining stacks, current pot including a pending bet, prior betting actions, a profile, concept, illustrative size, preferred line and explanations for every accepted action. Amounts are BB. Context is six-max preflop with a heads-up BTN/BB pot, 100 BB initial stacks, 0.5/1 blinds and no rake or antes. Other players fold and SB contributes 0.5 dead BB. BTN opens to 3 and BB calls, making 6.5 BB. Prior flop bets/calls of 3 and turn bets/calls of 6 yield 12.5 and 24.5 BB, respectively; checked-through fixtures retain the 6.5 BB pot. A pending villain bet increases the displayed pot and decreases their remaining stack, not the hero's stack.

Value betting, bluff selection, checking/pot control, draws/changing boards, calling/folding, and basic sizing each have examples. The fixture catalogue is the exported `POSTFLOP` array; IDs and answers are stable inputs to saved progress. Judgments with accepted alternatives are labeled. Profiles describe assumed tendencies, never actual hidden cards. A single preferred teaching line is not a universal optimal strategy. Only valid check/bet or facing-bet fold/call/raise controls are shown. Sizes are fixed illustrative choices, not a sizing solver. Existing preflop tools and statistics retain their meanings.

## Deterministic texture

`lib/postflop/texture.ts` validates card ranks, suits and uniqueness before analysis. Suits use spades/hearts/diamonds/clubs (0–3); ranks are 2–14. Input accepts As, Kh, Td or 10d notation.

Paired ranks, suit distribution, and all ten five-rank straight windows (including the wheel) are computed directly. Monotone and two-tone are explicit suit-count labels; rainbow means every board card has a distinct suit. Longer boards with three/four distinct suits are labeled accordingly rather than calling a five-card board rainbow.

The wet/dry heuristic marks a texture coordinated when a suit appears at least twice on the flop/turn, at least three times on the river, or at least three board ranks fit within a five-rank window. This is a disclosed teaching heuristic, not a strategic classification that proves a bet is correct.

Board-compatible straight/flush possibilities are distinct from an actual hand. The existing evaluator reports the hero's actual best-five made hand. Four cards of one suit on flop/turn are a flush draw, never a made flush. Straight-completing ranks are identified by testing a one-card addition to known ranks; they are not guaranteed winning outs. Backdoor possibilities are not called immediate flush draws. River analyses have no future drawing outs.

## Adaptive retrieval

`pokerlab-postflop-v1` stores validated exercise ID, legal action and device-calendar day observations independently of existing progress keys. The first answer per exercise per day determines its retrieval result, even if the player corrects it immediately afterward. Successful later-day retrievals schedule 1, 3, 7 and 14-day intervals; an error returns to a one-day interval. This does not require continuous daily attendance.

Adaptive order is: due incorrect exercises, other due reviews, unseen material, then not-yet-due material. Within a group it favors lower-performing concepts and earlier due dates, with stable catalogue ordering for ties. Previously missed mode includes historical misses even after later improvement. Street/concept filters and a full catalogue remain available.

Concept coverage counts distinct exercise IDs, using each exercise's latest first-of-day retrieval. Repetition does not create more independent topic evidence. These are practice observations, not a mastery or profitability certification. Phase 2's historic attempt accuracy is preserved and is not reinterpreted as mastery; older records lack retrieval dates. Storage failures leave practice usable in memory. Invalid Phase 3 records are left untouched rather than automatically overwritten.

## Saved hands and replay

`lib/hand-session.ts` wraps the unchanged betting engine with an action journal. An origin stores the seed, dealer, hand number and four starting stacks; commands store action and optional raise/bet total. Restoration reconstructs the initial deal and reapplies each command through the engine. It validates the version, integer stacks totaling 4,000, seat/dealer constraints, command syntax, legal action/size/turn order, bounded history, completed replay status, and chip conservation. It never trusts a serialized deck or arbitrary derived game state. Changing engine semantics in a future release requires a journal schema/migration decision.

The table session is an additive `table` field in the existing `pokerlab-progress` record. The new reducer updates journal, statistics and decision history together; one localStorage write persists them together. Hydration is gated before bots can act. Restoring a completed hand does not count it again. Invalid saved hands show an explicit Reset saved table action and are not replaced before that action. Reset preserves known training progress and game statistics. A browser storage denial allows in-memory play with a warning.

Up to twenty completed journals are retained. Replay reconstructs states and projects only public information: hero cards, then-known board, stack sizes, pot, actor and legal actions. Opponent cards are null before a contested showdown and folded cards stay concealed. Uncontested wins do not reveal opponents' cards. All-in runouts add separate board reveal frames without paying awards early. Streets that were never dealt are unavailable. This is local UI information hygiene, not cryptographic hiding: the deterministic seed and engine are available locally.

Hands played before this phase lack reconstructable journals, so they cannot be retroactively replayed. No hand histories are fabricated from old statistics or plain logs.

## Export/import contract

The Phase 3 backup format is `{format: "pokerlab-progress", version: 3, game, training, postflop}`. Phase 5 adds an optional-version-4 Review Studio section while retaining older import compatibility. Game includes statistics, lessons, human decisions and the optional table session; training contains Phase 2 state; postflop contains Phase 3 observations. No credentials or environment values are included. Files stay local.

Import validates all included sections and journals before any write. Supported version-2 envelopes contain `game` and `training`; importing them preserves existing Phase 3 data. Unknown versions, malformed records, illegal histories, duplicate/unknown exercise references, and files above 5 MB are rejected. This is an application-specific versioned envelope, not arbitrary JSON detection.

A validated file opens a modal describing replacement. **Cancel import** changes nothing. **Confirm replacement** is mandatory before writing; data is replaced rather than merged. A successful import reloads the page to hydrate all consumers consistently. Export before replacement to retain both histories. Writes across the three browser keys use best-effort rollback on a write failure; browser storage has no multi-key transaction. If rollback itself is blocked, the error explicitly reports incomplete rollback. Backups should be retained externally. Simultaneous-tab editing and automatic conflict resolution are not supported.

## Quality and current limits

Unit tests check every fixture's actual evaluated hand, card uniqueness, street count, legal/accepted choices, pot/stack arithmetic, texture and draw distinctions, repeated-exercise evidence, due ordering, deterministic restoration, replay concealment and runouts, historical limits, import validation, confirmation and rollback. Existing betting/side-pot/tie tests are retained. Browser checks cover end-to-end postflop work, texture input errors, unfinished-hand resume, completed replay, safe restoration reset, downloadable backups, cancelled/invalid/confirmed import, old training preservation, and 320–1440px layouts.

The postflop bank is finite and heads-up only. Profiles and feedback are heuristic teaching assumptions. Retrieval intervals are a transparent simple schedule, not a validated learning model. Postflop teaching does not infer equity or EV. Phase 4 adds a separate conditional probability lab; full GTO solving, tournament ICM, multiplayer, cloud sync and third-party hand-history parsing remain outside scope.

Potential Phase 4 work: expert-reviewed multiway fixtures, richer linked hand-to-lesson review, cross-exercise concept checks, accessibility audits, and user-controlled backup merging. Validate educational claims before considering any solver-backed features.
