# Phase 6 educational quality audit

This is a source and deterministic-test audit, not an external poker educator review or a validation study. The distinction matters: legal cards and correct arithmetic do not prove strategic optimality or assessment validity.

## Scope and evidence

Reviewed the Phase 1 Learn explanations and hand-ranking/evaluator interface; Phase 2 decision explanations, matrix disclosures, odds and daily lessons; Phase 3 30 scenarios and texture labels; Phase 4 equity assumptions, six examples and five outs exercises; Phase 5 review information boundaries, explicit teaching rules and personal-reflection metrics; and all new Academy materials.

`lib/academy/audit.ts` checks the 98 Academy fixtures, 15 older preflop fixtures, 30 postflop fixtures, five odds quizzes, five draw exercises and six equity examples. It validates cards, mapped concepts, answer contracts, accepted legal actions, street counts, suggested sizes, unique rounded odds answers, actual draw counts and valid equity inputs. Existing tests independently cover postflop prior-pot/stack arithmetic, engine side pots and reopening, hidden information and weighted equity. New Academy tests also specify independent expected answers for representative hand categories, minimum raises, pot odds, split shares, card-removal counts and blocked draws. A passing structural audit cannot certify all natural-language advice.

## Findings and changes

| Material | Finding | Resolution / status |
| --- | --- | --- |
| Phase 1 action lesson | “A short all-in does not reopen raising” was too broad: cumulative short increases can reopen action once a full increase is faced. | Corrected the lesson to distinguish one short increase from cumulative reopening, matching existing engine tests. Engine behavior was preserved. |
| Phase 2 preflop grading | Preferred beginner baselines can reject alternatives that are legal and strategically defensible under different assumptions (e.g. calling with AA or AKo at short depth). | Existing explanations disclose simplified baseline choices. Historical grading/IDs were preserved for compatibility. External educator review remains needed; new Academy questions grade conditional reasoning and can accept multiple lines. |
| Opening matrix | Position-based opening samples cannot establish exact GTO, calling ranges or applicability to every rake/depth/opponent. | Existing approximation disclosure retained; Academy explicitly teaches these limits. No solver claims added. |
| Phase 3 texture / draws | Wet/dry is a heuristic. Possible flush/straight patterns do not establish an opponent's actual made hand. | Existing distinction retained. Academy factual questions grade suit/rank facts and actual hero cards, not wet/dry as universal truth. |
| Phase 4 draw arithmetic | Overlapping flush/straight candidates must be deduplicated and known cards removed. Completing a draw can still lose. | Existing implementation/assumptions retained; new blocked-card and known-river-showdown questions explicitly test these cases. No generic clean-outs claim. |
| Phase 4 equity | Exact enumeration is exact only under supplied cards/ranges; Monte Carlo intervals do not validate a range or make strategy optimal. Tie frequency differs from fractional share. | Existing labels retained; Academy explicitly assesses split shares, conditional exactness, sampling uncertainty and separate versus simultaneous intervals. |
| Phase 5 review | Future runouts, later folds and showdown reveals must not enter earlier decision equity. Saved reflections are subjective. | Existing projected model and privacy tests retained. Academy reads only saved reflection summaries and labels them separately from assessment evidence. |
| Academy completion / scores | A completion badge or repeated fixture can appear stronger than the evidence supports. | Completion is an activity cycle, not mastery. Only first-exposure semantic contexts contribute evidence; finite bank limits and provisional teaching thresholds are visible. No global skill rating. |
| Academy range visuals | Displayed example range-member cards could be mistaken for blockers in a “no blockers” question. | Explicitly labeled illustrative cards versus known unavailable cards; full class names are included in counting prompts. |

## Verification categories

**Rules / mathematically checkable:** legal turn/action constraints, hand categories and ties, contribution-based pot eligibility, immediate call fractions under explicit assumptions, equal-pot fractional shares, suit/rank detection, physical combo counting, card removal, union-of-draw candidates, and conditional equity calculations. These are covered by deterministic tests. Confidence intervals are statistical procedures under a sampling model, not guarantees for one particular result.

**Heuristic / context dependent:** opening selections, opponent tendency interpretations, value targets, bluff credibility, checking to control pots, defender responses, wet/dry summaries, and recommendations to study a topic. The Academy labels strategy reasoning and does not assign invented precise equity, betting EV or solver-backed optimal actions. Thresholds for study recommendations are product teaching choices.

**Not externally validated:** strategic appropriateness across stakes/rake/formats; question difficulty/discrimination; transfer from authored fixtures to actual play; the 75% triage cutoff; the independence of conceptually similar but distinct questions; retention gains; and advanced-course sufficiency. No material is described as externally expert-reviewed. Existing Phase 3 retrieval timing remains a scheduling heuristic, distinct from Academy assessment evidence.

## Priorities for another phase

1. Independent educator review of every strategic fixture, especially alternative preflop lines, ambiguous wording and conditional assumptions.
2. Broader transfer tasks with explanations authored by the learner, reviewed for scoring consistency; a larger genuinely distinct assessment bank.
3. Usability/accessibility testing with beginners and assistive technology, followed by a study of learning/retention before making proficiency claims.
4. A curriculum-version migration policy before changing question meanings or semantic keys. Never silently regrade historical evidence after an answer-key change.

No full GTO solver, paid service, live assistance or gambling integration is required for these priorities.
