import { validateGameProgress } from "./progress-validation";
export type Decision = {
  hand: number;
  street: string;
  action: string;
  position: string;
};
export type Progress = {
  version: 1;
  hands: number;
  wins: number;
  decisions: Decision[];
  lessons: string[];
};
export const emptyProgress: Progress = {
  version: 1,
  hands: 0,
  wins: 0,
  decisions: [],
  lessons: [],
};
/** A safe in-memory fallback is not permission to overwrite a damaged record.
 * usePokerSession separately validates the original and blocks writes on failure.
 */
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem("pokerlab-progress");
    if (raw !== null) return validateGameProgress(JSON.parse(raw));
  } catch {}
  return { ...emptyProgress, decisions: [], lessons: [] };
}
