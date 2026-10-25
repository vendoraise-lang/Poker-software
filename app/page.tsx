"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import WorkspaceLinks from "@/components/WorkspaceLinks";
import EquityLab from "@/components/EquityLab";
import TrainingHub from "@/components/TrainingHub";
import usePokerSession from "@/components/usePokerSession";
import CasinoRoom from "@/components/CasinoRoom";
import { botAction, ranks } from "@/lib/poker";

const lessons = [
  {
    id: "position",
    title: "Position is power",
    text: "The button acts last after the flop when still in the hand. The small blind and big blind post forced bets. UTG acts first preflop at a four-player table. Acting later gives you more information.",
  },
  {
    id: "actions",
    title: "Know your options",
    text: "Check when nothing is owed. Call matches the current bet, up to your remaining chips. Bet opens the betting; raise increases it. Fold gives up your claim to the pot. A full raise must increase the bet by at least the last full raise; a single short all-in does not by itself reopen raising; cumulative short increases can amount to a full raise.",
  },
  {
    id: "showdown",
    title: "Your best five",
    text: "Use any five cards from your two hole cards and the five community cards. Equal hands split the pot. All-in players can win only the portions they contributed to; remaining chips form side pots.",
  },
];
function WorkspaceQuery({ onChange }: { onChange: (value: string) => void }) {
  const requested = useSearchParams().get("workspace");
  useEffect(() => {
    onChange(
      requested &&
        ["Practice", "Train", "Equity", "Dashboard", "Learn"].includes(
          requested,
        )
        ? requested
        : "Practice",
    );
  }, [requested, onChange]);
  return null;
}
export default function Home() {
  const {
    game,
    progress,
    loaded,
    storageError,
    restoreError,
    takeAction,
    nextHand,
    resetTable,
    setProgress,
  } = usePokerSession();
  const [tab, setTab] = useState("Practice");
  function openWorkspace(value: string) {
    setTab(value);
    window.history.replaceState(null, "", `/?workspace=${value}`);
  }
  const [lesson, setLesson] = useState("position");
  useEffect(() => {
    if (
      loaded &&
      !restoreError &&
      game.actor > 0 &&
      game.street !== "Showdown"
    ) {
      const timer = setTimeout(() => {
        const b = botAction(game);
        takeAction(b.action, b.amount);
      }, 850);
      return () => clearTimeout(timer);
    }
  }, [game, loaded, restoreError, takeAction]);
  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <WorkspaceQuery onChange={setTab} />
      </Suspense>
      <aside className="sidebar" aria-label="Practice room navigation">
        <Link className="brand" href="/">
          ♧{" "}
          <span>
            Poker<span className="brand-light">Lab</span>
            <small>THE PRACTICE ROOM</small>
          </span>
        </Link>
        <div className="nav-caption">YOUR WORKSPACE</div>
        <nav>
          {[
            ["Practice", "◈"],
            ["Dashboard", "▥"],
            ["Learn", "▤"],
            ["Train", "✧"],
          ].map(([name, icon]) => (
            <button
              key={name}
              aria-label={name}
              onClick={() => openWorkspace(name)}
              className={tab === name ? "selected" : ""}
            >
              <span>{icon}</span>
              {name}
              {name === "Practice" && <i />}
            </button>
          ))}
          <Link href="/review" className="review-nav-link" aria-label="Review">
            <span>↺</span>Review
          </Link>
          <Link
            href="/academy"
            className="review-nav-link"
            aria-label="Academy"
          >
            <span>▤</span>Academy
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">● &nbsp; Local-first</div>
          <p>
            Your practice. Your progress.
            <br />
            Saved on this device.
          </p>
          <div className="profile">
            <span>Y</span>
            <div>
              You<small>Independent learner</small>
            </div>
          </div>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className={tab === "Practice" ? "play-screen" : undefined}>
        <header>
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{tab}</b>
          </div>
          <span className="chip-tag">✦ &nbsp; PLAY CHIPS ONLY</span>
        </header>
        <div className="page-content">
          <WorkspaceLinks current={tab === "Practice" ? "Play" : tab} />
          {tab === "Practice" && <Link className="casino-learn-entry" href="/bootcamp"><span><strong>NEW · 30-minute training course</strong><small>Four practical lessons to improve your next hand.</small></span><span>Start learning →</span></Link>}
          <div className={`page-heading ${tab === "Practice" ? "practice-heading-compact" : ""}`}>
            <div>
              {tab !== "Practice" && <div className="eyebrow">A LITTLE PRACTICE. A BETTER PLAYER.</div>}
              <h1>
                {tab === "Practice"
                  ? "Take your seat."
                  : tab === "Dashboard"
                    ? "See your practice history."
                    : tab === "Train"
                      ? "Make every decision a lesson."
                      : tab === "Equity"
                        ? "Explore poker probability."
                        : "Build your poker intuition."}
              </h1>
              {tab !== "Practice" && <p>
                {tab === "Practice"
                  ? "A focused space to think, play, and improve. No stakes attached."
                  : tab === "Dashboard"
                    ? "Every hand is another opportunity to learn."
                    : "Understand the fundamentals. Bring them to the table."}
              </p>}
            </div>
            <div className="session-status">
              <span /> Training session{" "}
              <small>
                {tab === "Train"
                  ? "6-max drills · Self-paced"
                  : tab === "Equity"
                    ? "2–6 players · Probability lab"
                    : "No-limit Hold’em · 4 players"}
              </small>
            </div>
          </div>
          {storageError && (
            <p role="alert" className="error">
              Browser storage is unavailable or the saved record changed in
              another tab. New progress is in memory only. Reload to load the
              latest saved record; existing data has not been replaced.
            </p>
          )}
          {restoreError && (
            <div className="answer-feedback reconsider" role="alert">
              <p>{restoreError}</p>
              <button className="primary" onClick={resetTable}>
                Reset saved table
              </button>
            </div>
          )}
          {tab === "Practice" ? (
            <CasinoRoom game={game} loaded={loaded} restoreError={restoreError} takeAction={takeAction} nextHand={nextHand} />
          ) : tab === "Dashboard" ? (
            <>
              <div className="stat-grid">
                {[
                  ["Hands played", progress.hands],
                  ["Hands won", progress.wins],
                  [
                    "Win rate",
                    `${progress.hands ? Math.round((progress.wins / progress.hands) * 100) : 0}%`,
                  ],
                  ["Practice-room lessons", `${progress.lessons.length} / 3`],
                ].map(([label, value]) => (
                  <div className="stat" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="content-panel">
                  <h2>Decision history</h2>
                  <p>Your most recent 200 decisions, saved on this device.</p>
                  {progress.decisions.length ? (
                    <div className="history-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Hand</th>
                            <th>Position</th>
                            <th>Street</th>
                            <th>Decision</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progress.decisions.map((d, i) => (
                            <tr key={i}>
                              <td>#{d.hand}</td>
                              <td>{d.position}</td>
                              <td>{d.street}</td>
                              <td>{d.action}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      Your story starts with a hand.
                      <button
                        className="primary"
                        onClick={() => openWorkspace("Practice")}
                      >
                        Take your seat →
                      </button>
                    </div>
                  )}
                </section>
                <section className="content-panel">
                  <h2>Practice-room lessons</h2>
                  <p>
                    These are the three introductory Learn cards. Structured
                    lessons and assessments are tracked separately in the{" "}
                    <Link href="/academy" className="academy-dashboard-link">
                      Academy learning dashboard
                    </Link>
                    .
                  </p>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${(progress.lessons.length / 3) * 100}%`,
                      }}
                    />
                  </div>
                  {lessons.map((l) => (
                    <button
                      className="lesson-row"
                      key={l.id}
                      onClick={() => {
                        setLesson(l.id);
                        openWorkspace("Learn");
                      }}
                    >
                      <span>{progress.lessons.includes(l.id) ? "✓" : "○"}</span>
                      {l.title}
                      <span>→</span>
                    </button>
                  ))}
                  <p className="fine-print">
                    A won hand means a positive net chip result. Win rate
                    measures outcomes, not decision quality. Unfinished hands
                    and training progress persist on this device.
                  </p>
                </section>
              </div>
            </>
          ) : tab === "Equity" ? (
            <EquityLab />
          ) : tab === "Train" ? (
            <TrainingHub />
          ) : (
            <div className="learn-grid">
              <section className="content-panel">
                <div className="eyebrow">THE FUNDAMENTALS</div>
                <h2>One concept at a time.</h2>
                {lessons.map((l) => (
                  <button
                    key={l.id}
                    className={`lesson-row ${lesson === l.id ? "current" : ""}`}
                    onClick={() => setLesson(l.id)}
                  >
                    <span>{progress.lessons.includes(l.id) ? "✓" : "○"}</span>
                    {l.title}
                    <span>→</span>
                  </button>
                ))}
                <article className="lesson-article">
                  <h2>{lessons.find((l) => l.id === lesson)?.title}</h2>
                  <p>{lessons.find((l) => l.id === lesson)?.text}</p>
                  <button
                    className="primary"
                    onClick={() =>
                      setProgress((p) => ({
                        ...p,
                        lessons: [...new Set([...p.lessons, lesson])],
                      }))
                    }
                  >
                    {progress.lessons.includes(lesson)
                      ? "✓ Lesson explored"
                      : "Mark as explored"}
                  </button>
                </article>
              </section>
              <section className="content-panel">
                <div className="eyebrow">STRONGEST TO WEAKEST</div>
                <h2>The hand hierarchy</h2>
                <p>A royal flush is an ace-high straight flush.</p>
                {[...ranks].reverse().map((r, i) => (
                  <div className="ranking" key={r}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <b>{r}</b>
                    <small>
                      {
                        [
                          "A K Q J 10, same suit",
                          "Four equal ranks",
                          "Three + a pair",
                          "Five of one suit",
                          "Five consecutive ranks",
                          "Three equal ranks",
                          "Two distinct pairs",
                          "Two equal ranks",
                          "Highest cards",
                        ][i]
                      }
                    </small>
                  </div>
                ))}
              </section>
            </div>
          )}
          <footer>
            <span>
              ♧ PokerLab <span className="muted"> / The practice room</span>
            </span>
            <span>Built for learning. Always play chips.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
