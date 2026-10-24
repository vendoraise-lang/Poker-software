"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { newHand, position, legal, type Game, type Action } from "@/lib/poker";
import { validateGameProgress } from "@/lib/progress-validation";
import { emptyProgress, loadProgress, type Progress } from "@/lib/progress";
import {
  freshSession,
  nextTable,
  tableAction,
  validateSession,
  type TableSession,
} from "@/lib/hand-session";
type State = {
  game: Game;
  progress: Progress;
  session: TableSession;
  loaded: boolean;
  restoreError: string;
};
type Event =
  | { type: "hydrate"; progress: Progress; table: unknown }
  | { type: "action"; action: Action; amount?: number }
  | { type: "next" }
  | { type: "reset" }
  | { type: "progress"; fn: (p: Progress) => Progress };
function initial(): State {
  const game = newHand(2026);
  return {
    game,
    progress: emptyProgress,
    session: freshSession(game),
    loaded: false,
    restoreError: "",
  };
}
function reducer(state: State, event: Event): State {
  if (event.type === "hydrate") {
    if (event.table === undefined)
      return { ...state, progress: event.progress, loaded: true };
    try {
      const restored = validateSession(event.table);
      return { ...state, ...restored, progress: event.progress, loaded: true };
    } catch {
      return {
        ...state,
        progress: event.progress,
        loaded: true,
        restoreError:
          "The saved hand or game statistics could not be validated. The original record remains untouched. Restore a valid backup in Train → Data, or explicitly reset the saved table. Reset keeps readable statistics but replaces damaged table data; unreadable statistics cannot be recovered.",
      };
    }
  }
  if (event.type === "progress")
    return { ...state, progress: event.fn(state.progress) };
  if (event.type === "reset") {
    const fresh = initial();
    return {
      ...fresh,
      progress: state.progress,
      session: { ...fresh.session, completed: state.session.completed },
      loaded: true,
    };
  }
  if (!state.loaded || state.restoreError) return state;
  if (event.type === "next") {
    const next = nextTable(state.session, state.game);
    return {
      ...state,
      ...next,
      progress:
        next.game.street === "Showdown"
          ? {
              ...state.progress,
              hands: state.progress.hands + 1,
              wins:
                state.progress.wins + (next.game.winners.includes(0) ? 1 : 0),
            }
          : state.progress,
    };
  }
  const next = tableAction(
    state.session,
    state.game,
    event.action,
    event.amount,
  );
  let progress = state.progress;
  if (state.game.actor === 0)
    progress = {
      ...progress,
      decisions: [
        {
          hand: state.game.hand,
          street: state.game.street,
          action: `${event.action}${event.amount !== undefined ? ` to ${event.amount}` : event.action === "call" ? ` ${legal(state.game).call}` : ""}`,
          position: position(state.game, 0),
        },
        ...progress.decisions,
      ].slice(0, 200),
    };
  if (next.game.street === "Showdown")
    progress = {
      ...progress,
      hands: progress.hands + 1,
      wins: progress.wins + (next.game.winners.includes(0) ? 1 : 0),
    };
  return { ...state, ...next, progress };
}
export default function usePokerSession() {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const [storageError, setStorageError] = useState(false);
  const [writeBlocked, setWriteBlocked] = useState(false);
  const snapshot = useRef<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const progress = loadProgress();
      let raw: string | null = null;
      try {
        raw = localStorage.getItem("pokerlab-progress");
        snapshot.current = raw;
      } catch {
        dispatch({ type: "hydrate", progress, table: undefined });
        setStorageError(true);
        return;
      }
      try {
        if (raw !== null) validateGameProgress(JSON.parse(raw));
        dispatch({
          type: "hydrate",
          progress,
          table: raw ? JSON.parse(raw)?.table : undefined,
        });
      } catch {
        dispatch({ type: "hydrate", progress, table: { invalid: true } });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (state.loaded && !state.restoreError && !writeBlocked)
      try {
        if (localStorage.getItem("pokerlab-progress") !== snapshot.current)
          throw Error("conflict");
        const serialized = JSON.stringify({
          ...state.progress,
          table: state.session,
        });
        localStorage.setItem("pokerlab-progress", serialized);
        snapshot.current = serialized;
      } catch {
        queueMicrotask(() => {
          setStorageError(true);
          setWriteBlocked(true);
        });
      }
  }, [
    state.progress,
    state.session,
    state.loaded,
    state.restoreError,
    writeBlocked,
  ]);
  const setProgress = useCallback(
    (fn: (p: Progress) => Progress) => dispatch({ type: "progress", fn }),
    [],
  );
  const takeAction = useCallback(
    (action: Action, amount?: number) =>
      dispatch({ type: "action", action, amount }),
    [],
  );
  const nextHand = useCallback(() => dispatch({ type: "next" }), []),
    resetTable = useCallback(() => dispatch({ type: "reset" }), []);
  return {
    ...state,
    storageError,
    setProgress,
    takeAction,
    nextHand,
    resetTable,
  };
}
