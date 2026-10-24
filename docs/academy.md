# Phase 6: Poker Academy & Skill Assessment

## Curriculum and interface

The dedicated `/academy` page is linked from the practice room. Seven modules each contain three explicit learning objectives, two short lessons with interactive card examples, two practice exercises, and a four-question assessment (two items per concept). The modules progress from rules to deeper reasoning; they do not constitute a complete advanced poker course.

| Module | Concepts | Existing follow-up |
| --- | --- | --- |
| 1. Rules, actions and hand rankings | Legal actions; best-five rankings | Preflop practice |
| 2. Position and starting-hand selection | Action order; conditional selection reasoning | Opening decisions |
| 3. Pot odds and equity | Immediate price; fractional pot shares | Pot-odds trainer |
| 4. Postflop fundamentals | Value/pot control; defence/bluff reasoning | Postflop pot control |
| 5. Board textures and draws | Actual patterns; distinct completion cards and blockers | Draw practice |
| 6. Opponent ranges and blockers | Physical combinations; card removal | Review Studio range builder |
| 7. Hand review and uncertainty | Information cutoff; limits of probabilistic and learning evidence | Review Studio and defence practice |

`lib/academy/content.ts` contains 98 documented fixtures: 14 study examples and 84 assessment items (six per concept). Card and mathematical answers use the existing evaluator, texture, range, draw and odds functions. Independent test expectations check important calculations rather than merely comparing the functions with themselves. No new game or equity engine was introduced.

Lessons are intentionally short. They include visible cards where relevant; pure arithmetic/statistical questions use explicit quantities rather than decorative or misleading deals. In range-counting examples, illustration cards represent a member of the range, **not blockers**. Blocker examples label their known unavailable cards explicitly, which can be one or three cards rather than a player's two-card hand.

## Assessment evidence

Every item declares `fact`, `math` or `judgment`. Judgment questions assess a conditional explanation, permit multiple defensible answers where appropriate, and disclose that strategy advice is heuristic and externally unvalidated. Incorrect answers display the calculation or reasoning. Accepted answers also receive explanations. There is no financial EV, GTO action grading or global numerical player rating.

The deterministic planner prioritizes the weaker concept, selects two items per concept, and takes unseen semantic keys before familiar items. Starting an assessment reserves its four contexts immediately. One assessment can be active; it resumes after reload and cannot be discarded to manufacture a new first attempt. Answers must arrive once and in order. Both abandoned-but-reserved contexts and completed contexts remain familiar.

Only an answer to a first-exposure assessment context adds concept evidence. Practice never adds evidence. Repeats remain answerable and are clearly identified, but cannot erase earlier errors or increase independent counts. Equivalent pair-combination questions (KK versus AA) and one-pair-blocker questions share keys. Pot-odds keys reduce bet/pot ratios so scaling chip units does not create novelty. Known matching Phase 2 odds and opening exposures are carried forward as seen keys, without claiming they were assessed successfully. Other older statistics and self-reflections remain separate; there is no comprehensive cross-bank or external-exposure detector.

Novelty is limited to this authored bank and its explicit semantic keys. Suit permutations or slightly reworded questions are not generated to claim fresh evidence. After exhaustion, reassessment produces feedback but no further independent evidence. Broad conceptual transfer would require a larger externally reviewed bank and external validation.

Concept panels separate factual/mathematical from judgment results. Fewer than two first-exposure answers means insufficient evidence. With at least two, an acceptance fraction below 75% triggers study. These are transparent teaching thresholds, **not scientifically validated proficiency cutoffs**. Early/recent comparisons require at least four distinct contexts and compare small different samples, not a controlled learning experiment. Recommendations prioritize modules with repeatedly weak concepts, then the earliest unfinished activity cycle. Each concept links to its lesson; modules link to relevant existing drills.

A module activity cycle is complete after both lessons have been explored (each requires attempting its example) and a four-question assessment has finished. Passing is not required: completion measures participation and is explicitly separate from understanding. The dashboard shows completed cycles, evidence by concept, study suggestions, recent saved Review Studio self-reflections, and a dated event history. No missed-day penalty exists.

## Persistence, upgrades and backups

`pokerlab-academy-v1` is a separate version-1 event log. It stores prior seen keys and sequential, timestamped practice, lesson, assessment-start, answer and finish events. Derived correctness, novelty, evidence and completion are recomputed through validated replay. Imported claimed grades are discarded. Unknown items/options, unsupported schema versions, impossible event order, incomplete finish events, invalid dates, duplicate contexts inside a session and incompatible module plans are rejected. History is capped at 5,000 events; exceeding it reports an error rather than dropping evidence silently.

An absent key initializes the new schema without modifying Phase 1–5 keys. There is no earlier Academy schema to migrate. Known Phase 2 exposures are mapped on initialization. A malformed Academy save stays untouched and the UI allows in-memory study with a warning; recovery uses an explicitly confirmed valid backup. Concurrent changes to the Academy key are detected before a write and require reload, avoiding silent last-writer replacement. Browser-denied or full storage is reported; in-memory changes are not represented as saved/exported history.

Backup version 5 adds required validated `academy` data and optional Review Studio data. Versions 2, 3 and 4 remain supported. An old backup omitting Academy or Review sections preserves those existing keys; version 2 likewise preserves Phase 3. Exports continue to use version 3 or 4 when no Academy key exists. Imports validate all sections before mutation, require explicit replacement confirmation, and attempt rollback on storage failure. Confirmed replacement is not a merge. Existing local journals, review data and game statistics retain their schemas.

## Validation and boundaries

The Academy tests cover factual answers, legal cards/actions, semantic duplicates, unseen-first reassessment, exhausted banks, reload replay, separate scoring, completion versus mastery, recommendations, malformed records, backup upgrades/compatibility and rollback. Browser coverage includes the lesson/assessment cycle, partial resume, feedback, first-exposure versus familiar labels, malformed storage/imports, cancelled and confirmed replacement, concurrent changes, and 320–1440-pixel layouts. Existing poker, equity and hidden-information tests remain unchanged.

See [the educational audit](educational-audit.md) for fixed wording, heuristic disclosures, audit scope and remaining external-review needs. The interface remains local-first and play-chip only. There is no instructor certification, live poker assistance, automated betting, paid API, gambling integration or new solver.

Final validation results are recorded in [the Phase 6 validation record](phase6-validation.md): 265 unit tests, 50 production-browser tests, lint, type checking and production build all passed.
