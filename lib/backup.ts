import { validateGameProgress } from "./progress-validation";
import {
  validateTraining,
  TRAINING_KEY,
  type TrainingProgress,
} from "./training/progress";
import { validatePost, POST_KEY, type PostProgress } from "./postflop/progress";
import { validateSession, type TableSession } from "./hand-session";
import { REVIEW_KEY, validateReview, type ReviewData } from "./review/progress";
import {
  ACADEMY_KEY,
  validateAcademy,
  type AcademyData,
} from "./academy/progress";
import type { Progress } from "./progress";
export type Backup = {
  format: "pokerlab-progress";
  version: 3 | 4 | 5;
  academy?: AcademyData;
  review?: ReviewData;
  game: Progress & { table?: TableSession };
  training: TrainingProgress;
  postflop: PostProgress;
};
export const strictTraining = validateTraining;
export function validateBackup(
  raw: string,
): Omit<Backup, "postflop"> & { postflop: PostProgress | null } {
  if (raw.length > 5 * 1024 * 1024)
    throw Error("Backup exceeds the 5 MB import limit.");
  let p: Backup;
  try {
    p = JSON.parse(raw);
  } catch {
    throw Error("Select a valid JSON backup.");
  }
  if (
    !p ||
    p.format !== "pokerlab-progress" ||
    ![2, 3, 4, 5].includes(p.version)
  )
    throw Error("Unsupported backup format or version.");
  const game = validateGameProgress(p.game);
  if (p.game.table !== undefined)
    Object.assign(game, { table: validateSession(p.game.table).session });
  return {
    format: "pokerlab-progress",
    version: p.version === 5 ? 5 : p.version === 4 ? 4 : 3,
    ...(p.version === 5 ? { academy: validateAcademy(p.academy) } : {}),
    ...(p.version === 4 || (p.version === 5 && p.review !== undefined)
      ? { review: validateReview(p.review) }
      : {}),
    game,
    training: strictTraining(p.training),
    postflop: p.version !== (2 as number) ? validatePost(p.postflop) : null,
  };
}
export function collectBackup(storage: Pick<Storage, "getItem">): Backup {
  const game = JSON.parse(
      storage.getItem("pokerlab-progress") ??
        '{"version":1,"hands":0,"wins":0,"decisions":[],"lessons":[]}',
    ),
    training = JSON.parse(
      storage.getItem(TRAINING_KEY) ??
        '{"version":1,"attempts":[],"sessions":[],"daily":null}',
    ),
    postflop = JSON.parse(
      storage.getItem(POST_KEY) ?? '{"version":1,"attempts":[]}',
    );
  const reviewRaw = storage.getItem(REVIEW_KEY);
  const academyRaw = storage.getItem(ACADEMY_KEY);
  return validateBackup(
    JSON.stringify({
      format: "pokerlab-progress",
      version: academyRaw !== null ? 5 : reviewRaw === null ? 3 : 4,
      ...(academyRaw === null ? {} : { academy: JSON.parse(academyRaw) }),
      ...(reviewRaw === null ? {} : { review: JSON.parse(reviewRaw) }),
      game,
      training,
      postflop,
    }),
  ) as Backup;
}
export function applyBackup(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  backup: ReturnType<typeof validateBackup>,
  confirmed: boolean,
) {
  if (!confirmed) throw Error("Explicit overwrite confirmation is required.");
  const checked = validateBackup(
    JSON.stringify({
      ...backup,
      version: backup.academy
        ? 5
        : backup.review
          ? 4
          : backup.postflop === null
            ? 2
            : 3,
    }),
  );
  const entries: [string, string][] = [
    ["pokerlab-progress", JSON.stringify(checked.game)],
    ...(checked.academy
      ? [[ACADEMY_KEY, JSON.stringify(checked.academy)] as [string, string]]
      : []),
    [TRAINING_KEY, JSON.stringify(checked.training)],
    ...(checked.review
      ? [[REVIEW_KEY, JSON.stringify(checked.review)] as [string, string]]
      : []),
    ...(checked.postflop
      ? [[POST_KEY, JSON.stringify(checked.postflop)] as [string, string]]
      : []),
  ];
  const old = entries.map(([key]) => [key, storage.getItem(key)] as const);
  try {
    for (const [key, value] of entries) storage.setItem(key, value);
  } catch {
    let restored = true;
    for (const [key, value] of old)
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        restored = false;
      }
    throw Error(
      restored
        ? "Import failed; previous values were restored."
        : "Import failed and browser storage prevented full rollback. Restore a previously exported backup when storage is available.",
    );
  }
}
