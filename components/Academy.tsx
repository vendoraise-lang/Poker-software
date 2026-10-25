"use client";
import WorkspaceLinks from "./WorkspaceLinks";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import ProgressBackup from "./ProgressBackup";
import {foundationGuides} from "@/lib/academy/beginner";
import {
  MODULES,
  LABELS,
  getQuestion,
  gradeQuestion,
  optionOrder,
  type Question,
} from "@/lib/academy/content";
import {
  ACADEMY_KEY,
  emptyAcademy,
  validateAcademy,
  academyState,
  conceptResults,
  moduleCompleted,
  recommendedLesson,
  legacyAcademyKeys,
  practiceAnswer,
  completeLesson,
  beginAssessment,
  answerAssessment,
  finishAssessment,
  type AcademyData,
} from "@/lib/academy/progress";
import { parseTraining, TRAINING_KEY } from "@/lib/training/progress";
import {
  REVIEW_KEY,
  validateReview,
  type ReviewData,
} from "@/lib/review/progress";

function Exercise({
  q,
  session,
  onAnswer,
  answer,
}: {
  q: Question;
  session: number;
  onAnswer: (choice: string) => void;
  answer?: string;
}) {
  const grade = answer ? gradeQuestion(q.id, answer) : null;
  return (
    <article className="academy-exercise" data-question={q.id}>
      <span className="eyebrow">
        {q.kind === "judgment"
          ? "CONTEXT-DEPENDENT REASONING · MULTIPLE LINES MAY BE DEFENSIBLE"
          : q.kind === "math"
            ? "MATHEMATICAL CALCULATION"
            : "FACTUAL UNDERSTANDING"}
      </span>
      <h3>{q.prompt}</h3>
      <p>{q.context}</p>
      <div className="academy-card-groups">
        {[
          [
            q.concept === "blockers"
              ? "Known unavailable cards"
              : "Example cards",
            q.hero,
          ],
          ["Community cards", q.board],
          ...q.opponents.map(
            (cs, i) => [`Known opponent ${i + 1}`, cs] as const,
          ),
        ].map(
          ([label, cards]) =>
            typeof cards !== "string" &&
            cards.length > 0 && (
              <div key={label as string}>
                <small>{label as string}</small>
                <div className="academy-cards">
                  {cards.map((card, i) => (
                    <Card key={i} card={card} small />
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
      <div className="academy-choices">
        {optionOrder(q, session).map((o) => (
          <button
            key={o.id}
            disabled={!!answer}
            aria-pressed={answer === o.id}
            onClick={() => onAnswer(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {grade && (
        <div className="academy-feedback" role="status">
          <strong>
            {grade.accepted ? "Accepted reasoning" : "Let’s examine this"}
          </strong>
          <p>{grade.explanation}</p>
          <details className="academy-deep-dive"><summary>Why this answer?</summary><small>{q.basis}</small></details>
        </div>
      )}
    </article>
  );
}
export default function Academy() {
  const [data, setData] = useState<AcademyData>(emptyAcademy),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState(""),
    [moduleId, setModuleId] = useState(1),
    [view, setView] = useState("Lessons"),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [feedback, setFeedback] = useState<string | null>(null),
    [reviews, setReviews] = useState<ReviewData | null>(null);
  const storedSnapshot = useRef<string | null>(null);
  const pendingLesson = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingLesson.current || view !== "Lessons") return;
    const target = document.getElementById(`academy-lesson-${pendingLesson.current}`);
    if (!target) return;
    pendingLesson.current = null;
    target.scrollIntoView({ behavior: "instant", block: "start" });
    target.focus({ preventScroll: true });
  }, [moduleId, view]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(ACADEMY_KEY);
        storedSnapshot.current = raw;
        const p = raw
          ? validateAcademy(JSON.parse(raw))
          : {
              ...emptyAcademy(),
              priorKeys: legacyAcademyKeys(
                parseTraining(localStorage.getItem(TRAINING_KEY)),
              ),
            };
        setData(p);
        const active = academyState(p).active;
        if (active) {
          setModuleId(active.module);
          setView("Assessment");
        }
      } catch {
        setBlocked(true);
        setMessage(
          "Saved Academy data could not be restored. It remains untouched. You can study in memory; restore a validated backup using the backup controls below to save again.",
        );
      }
      try {
        const raw = localStorage.getItem(REVIEW_KEY);
        if (raw) setReviews(validateReview(JSON.parse(raw)));
      } catch {
        setMessage(
          (m) =>
            m +
            " Review activity could not be read; its saved data remains untouched.",
        );
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function update(change: (p: AcademyData) => AcademyData) {
    try {
      if (
        !blocked &&
        localStorage.getItem(ACADEMY_KEY) !== storedSnapshot.current
      )
        throw Error(
          "Academy history changed in another tab. Reload to use the newer history; this action has not replaced it.",
        );
      const next = change(data);
      setData(next);
      if (!blocked) {
        try {
          const serialized = JSON.stringify(next);
          localStorage.setItem(ACADEMY_KEY, serialized);
          storedSnapshot.current = serialized;
        } catch {
          setMessage(
            "Browser storage is unavailable. Changes are only in memory and are not included in stored backups.",
          );
        }
      }
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    }
  }
  const state = academyState(data),
    stats = conceptResults(state),
    currentModule = MODULES.find((m) => m.id === moduleId)!,
    recommendation = recommendedLesson(state),
    recommended = recommendation.currentModule,
    active = state.active;
  const activeQuestion =
    active && active.answers.length < 4
      ? getQuestion(active.questions[active.answers.length])
      : null;
  const shownQuestion = feedback ? getQuestion(feedback) : activeQuestion;
  const previous = active?.answers.find((a) => a.question === feedback);
  const completed = MODULES.filter((m) => moduleCompleted(state, m.id)).length;
  const last = state.sessions
    .filter((s) => s.module === moduleId && s.finished)
    .at(-1);
  return (
    <div className="academy-page">
      <header className="academy-header">
        <Link className="brand" href="/">
          ♧ PokerLab
        </Link>
        <nav aria-label="Academy navigation">
          <Link href="/">Practice room</Link>
          <Link href="/review">Hand review</Link>
          <Link href="/academy" aria-current="page">
            Academy
          </Link>
        </nav>
      </header>
      <main className="academy-main" id="main-content" tabIndex={-1}>
        <WorkspaceLinks current="Academy" />
        <span className="eyebrow">POKER ACADEMY · PLAY-CHIP EDUCATION</span>
        <h1>Understand the decision.</h1>
        <p className="academy-lead">
          Build a foundation, test your reasoning, and study what needs
          attention. No streak penalties. No claimed GTO or validated poker
          proficiency rating.
        </p>
        {!ready ? (
          <p role="status">Loading local learning history…</p>
        ) : (
          <>
            <p role="status" className="academy-message">
              {message}
            </p>
            <div className="academy-stats">
              <div>
                <strong>{completed} / 7</strong>
                <span>Module activity cycles completed</span>
              </div>
              <div>
                <strong>{state.evidence.length}</strong>
                <span>Distinct first-exposure answers</span>
              </div>
              <div>
                <strong>
                  {Object.values(stats).filter((s) => s.needsStudy).length}
                </strong>
                <span>Concepts needing evidence or study</span>
              </div>
            </div>
            <section className="content-panel academy-next">
              <div>
                <span className="eyebrow">RECOMMENDED NEXT</span>
                <h2>{recommendation.lesson.title}</h2>
                <p>
                  Module {recommended.id}: {recommended.title} ·{" "}
                  {LABELS[recommendation.lesson.concept]}
                </p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  pendingLesson.current = recommendation.lesson.id;
                  setModuleId(recommended.id);
                  setView("Lessons");
                  setFeedback(null);
                  // Handle selecting the already-visible module, which may not rerender.
                  if (moduleId === recommended.id && view === "Lessons") {
                    const target = document.getElementById(`academy-lesson-${recommendation.lesson.id}`);
                    if (target) {
                      pendingLesson.current = null;
                      target.scrollIntoView({ behavior: "instant", block: "start" });
                      target.focus({ preventScroll: true });
                    }
                  }
                }}
              >
                Study recommended module
              </button>
            </section>
            <div className="academy-layout">
              <aside className="academy-modules" aria-label="Modules">
                {MODULES.map((m) => (
                  <button
                    key={m.id}
                    aria-pressed={m.id === moduleId}
                    onClick={() => {
                      setModuleId(m.id);
                      setFeedback(null);
                    }}
                  >
                    <small>
                      MODULE {m.id} · {m.level}
                    </small>
                    <strong>{m.title}</strong>
                    <span>
                      {moduleCompleted(state, m.id)
                        ? "Activity cycle completed"
                        : "Continue learning"}
                    </span>
                  </button>
                ))}
              </aside>
              <section className="content-panel academy-module">
                <span className="eyebrow">MODULE {currentModule.id}</span>
                <h2>{currentModule.title}</h2>
                <details className="academy-deep-dive"><summary>What you’ll learn</summary><ul>
                  {currentModule.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul></details>
                <div className="academy-tabs" aria-label="Module activities">
                  {["Lessons", "Practice", "Assessment"].map((t) => (
                    <button
                      key={t}
                      aria-pressed={view === t}
                      onClick={() => {
                        setView(t);
                        setFeedback(null);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {view === "Lessons" &&
                  currentModule.lessons.map((l) => (
                    <section className="academy-lesson" key={l.id} id={`academy-lesson-${l.id}`} tabIndex={-1}>
                      <h3>{l.title}</h3>
                      <p className="academy-lesson-summary">{l.tryIt}</p><div className="beginner-guide"><span>BEGINNER EXPLANATION</span><p><b>First understand:</b> {foundationGuides[l.concept]?.meaning??l.text}</p><p><b>For example:</b> {foundationGuides[l.concept]?.example??l.tryIt}</p><p><b>Remember:</b> {foundationGuides[l.concept]?.remember??l.tryIt}</p></div>
                      <details className="academy-deep-dive"><summary>Read the full lesson</summary><p>{l.text}</p></details>
                      <Exercise
                        q={getQuestion(l.practiceId)}
                        session={0}
                        answer={answers[l.practiceId]}
                        onAnswer={(choice) => {
                          if (
                            update((p) =>
                              practiceAnswer(p, l.practiceId, choice),
                            )
                          )
                            setAnswers((a) => ({
                              ...a,
                              [l.practiceId]: choice,
                            }));
                        }}
                      />
                      <button
                        className="subtle-button"
                        disabled={
                          !state.practice.has(l.practiceId) ||
                          state.lessons.has(l.id)
                        }
                        onClick={() => update((p) => completeLesson(p, l.id))}
                      >
                        {state.lessons.has(l.id)
                          ? "Lesson explored"
                          : "Mark lesson explored"}
                      </button>
                      {state.practice.has(l.practiceId) &&
                        !answers[l.practiceId] && (
                          <p>
                            Example previously attempted. You can answer again
                            to revisit its explanation.
                          </p>
                        )}
                    </section>
                  ))}
                {view === "Practice" && (
                  <>
                    <p>
                      Study examples freely. Practice and repeated questions do
                      not add assessment evidence.
                    </p>
                    {currentModule.lessons.map((l) => (
                      <Exercise
                        key={l.id}
                        q={getQuestion(l.practiceId)}
                        session={0}
                        answer={answers[l.practiceId]}
                        onAnswer={(choice) => {
                          if (
                            update((p) =>
                              practiceAnswer(p, l.practiceId, choice),
                            )
                          )
                            setAnswers((a) => ({
                              ...a,
                              [l.practiceId]: choice,
                            }));
                        }}
                      />
                    ))}
                  </>
                )}
                {view === "Assessment" && (
                  <>
                    <p>
                      Four questions: two per concept. Unseen examples are
                      prioritized from a finite bank. First exposure only counts
                      as distinct evidence; familiar examples remain useful
                      study. Completion records activity, not mastery.
                    </p>
                    {active && active.module !== moduleId ? (
                      <button
                        className="primary"
                        onClick={() => {
                          setModuleId(active.module);
                          setFeedback(null);
                        }}
                      >
                        Resume reserved Module {active.module} assessment
                      </button>
                    ) : active ? (
                      <>
                        <p>
                          Question{" "}
                          {Math.min(
                            active.answers.length + (feedback ? 0 : 1),
                            4,
                          )}{" "}
                          of 4 · {active.freshKeys.length} previously unseen
                          contexts reserved
                        </p>
                        {shownQuestion && (
                          <>
                            <Exercise
                              q={shownQuestion}
                              session={active.id}
                              answer={previous?.choice}
                              onAnswer={(choice) => {
                                const id = shownQuestion.id;
                                if (update((p) => answerAssessment(p, choice)))
                                  setFeedback(id);
                              }}
                            />
                            <p className="teaching-note">
                              {active.freshKeys.includes(shownQuestion.key)
                                ? "First exposure: this answer contributes to concept evidence."
                                : "Familiar context: this answer will not add independent evidence."}
                            </p>
                          </>
                        )}
                        {feedback && (
                          <button
                            className="primary"
                            onClick={() => setFeedback(null)}
                          >
                            Continue assessment
                          </button>
                        )}
                        {active.answers.length === 4 && !feedback && (
                          <button
                            className="primary"
                            onClick={() => update(finishAssessment)}
                          >
                            Finish and review assessment
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          className="primary"
                          onClick={() => {
                            setFeedback(null);
                            update((p) => beginAssessment(p, moduleId));
                          }}
                        >
                          {last ? "Reassess this module" : "Start assessment"}
                        </button>
                        {last && (
                          <div className="academy-feedback">
                            <h3>Assessment review</h3>
                            <p>
                              {last.answers.filter((a) => a.accepted).length} of
                              4 accepted ·{" "}
                              {last.answers.filter((a) => a.fresh).length}{" "}
                              distinct first exposures.
                            </p>
                            {last.answers.map((a) => (
                              <details key={a.question}>
                                <summary>
                                  {LABELS[getQuestion(a.question).concept]} ·{" "}
                                  {a.accepted ? "Accepted" : "Revisit"} ·{" "}
                                  {a.fresh ? "first exposure" : "familiar"}
                                </summary>
                                <p>{getQuestion(a.question).prompt}</p>
                                <p>{getQuestion(a.question).explanation}</p>
                              </details>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                <p className="academy-drill">
                  <Link
                    href={
                      moduleId === 6
                        ? "/review"
                        : `/practice/${currentModule.drill}`
                    }
                  >
                    {moduleId === 6
                      ? "Explore opponent ranges in Review Studio →"
                      : "Open related training drill →"}
                  </Link>
                  {currentModule.id === 7 && (
                    <>
                      {" "}
                      · <Link href="/review">Review a recorded hand →</Link>
                    </>
                  )}
                </p>
              </section>
            </div>
            <section className="content-panel">
              <span className="eyebrow">YOUR LEARNING DASHBOARD</span>
              <h2>Concept evidence</h2>
              <p>
                Fewer than two distinct answers means insufficient evidence.
                Otherwise, below 75% accepted triggers a study suggestion. These
                are teaching thresholds, not validated proficiency standards.
                Strategy reasoning is tracked separately from facts and
                mathematics.
              </p>
              <div className="academy-concepts">
                {MODULES.flatMap((m) =>
                  m.concepts.map((c) => {
                    const s = stats[c];
                    return (
                      <article key={c}>
                        <h3>{LABELS[c]}</h3>
                        <strong>
                          {s.distinct < 2
                            ? "More evidence needed"
                            : s.needsStudy
                              ? "Revisit this concept"
                              : "Continue broadening contexts"}
                        </strong>
                        <p>
                          {s.factualAccepted}/{s.factual} factual / mathematical
                          · {s.judgmentsAccepted}/{s.judgments} judgment answers
                          accepted
                        </p>
                        <small>
                          {s.distinct} distinct contexts
                          {s.early !== null
                            ? ` · Earlier ${Math.round(s.early * 100)}%, recent ${Math.round(s.recent! * 100)}% (small, different samples)`
                            : " · Improvement needs at least four distinct examples"}
                        </small>
                        <div>
                          <button
                            className="subtle-button"
                            onClick={() => {
                              setModuleId(m.id);
                              setView("Lessons");
                              setFeedback(null);
                            }}
                          >
                            Study {LABELS[c]}
                          </button>
                        </div>
                      </article>
                    );
                  }),
                )}
              </div>
            </section>
            <div className="academy-bottom">
              <section className="content-panel">
                <h2>Recent hand-review activity</h2>
                <p>
                  Self-reflections are separate from assessed concept evidence.
                </p>
                {reviews?.observations.length ? (
                  <ul>
                    {reviews.observations
                      .slice(-5)
                      .reverse()
                      .map((o, i) => (
                        <li key={i}>
                          {o.day} · {o.topic} ·{" "}
                          {o.latest === "practice"
                            ? "Practice requested"
                            : "Self-reported understanding"}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>No saved hand-review observations yet.</p>
                )}
                <Link href="/review">Open Review Studio →</Link>
              </section>
              <section className="content-panel">
                <h2>Learning history</h2>
                {state.history.length ? (
                  <ol>
                    {state.history
                      .slice(-10)
                      .reverse()
                      .map((e) => (
                        <li key={e.seq}>
                          {e.at.slice(0, 10)} ·{" "}
                          {e.type === "lesson"
                            ? "Lesson explored"
                            : e.type === "practice"
                              ? "Practice attempted"
                              : e.type === "start"
                                ? "Assessment reserved"
                                : e.type === "answer"
                                  ? "Assessment answer recorded"
                                  : "Assessment completed"}
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p>Your learning activity will appear here.</p>
                )}
              </section>
            </div>
            <ProgressBackup />
            <p className="teaching-note">
              Curriculum: 7 modules, 14 concepts, 14 study examples and 84
              assessment fixtures. Novelty is tracked locally within this bank
              and matching older exercises; it cannot detect examples you have
              seen elsewhere. Strategic advice is heuristic and awaits
              independent educator review.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
