"use client";
import { useEffect, useRef, useState } from "react";
import { applyBackup, collectBackup, validateBackup } from "@/lib/backup";
export default function ProgressBackup() {
  const [pending, setPending] = useState<ReturnType<
      typeof validateBackup
    > | null>(null),
    [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);
  function download() {
    try {
      const backup = collectBackup(localStorage),
        raw = JSON.stringify(backup, null, 2),
        url = URL.createObjectURL(
          new Blob([raw], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = `pokerlab-progress-v${backup.version}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Backup exported. Keep the JSON file somewhere safe.");
    } catch {
      setMessage(
        "Export could not validate or read saved data. Your current data has not been changed.",
      );
    }
  }
  return (
    <section className="content-panel">
      <span className="eyebrow">YOUR PROGRESS, PORTABLE</span>
      <h2>Export / import progress</h2>
      <p>
        Back up game statistics, the saved hand and up to 20 replays, Phase 2
        training, Phase 3 practice, and saved Review Studio notes/ranges when
        present, plus Academy lessons and assessment history. Files stay on your
        device.
      </p>
      <div className="backup-controls">
        <button className="primary" onClick={download}>
          Export progress JSON
        </button>
        <label className="file-label">
          Choose JSON backup
          <input
            aria-label="Import progress JSON"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                if (file.size > 5 * 1024 * 1024)
                  throw Error("Backup exceeds the 5 MB import limit.");
                setPending(validateBackup(await file.text()));
                setMessage(
                  "Backup validated. Confirm or cancel replacement below.",
                );
              } catch (err) {
                setPending(null);
                setMessage(
                  (err as Error).message + " No progress was replaced.",
                );
              }
            }}
          />
        </label>
      </div>
      <p role="status">{message}</p>
      <p className="teaching-note">
        Version 5 backups add Academy data. Versions 2–4 remain supported and
        preserve newer sections when absent. Version 4 adds Review Studio data.
        Version 2 also preserves existing Phase 3 data. Other versions are
        rejected. Import replaces rather than merges the included histories.
      </p>
      <dialog
        ref={dialog}
        className="import-dialog"
        onCancel={() => setPending(null)}
        aria-labelledby="import-title"
      >
        <h2 id="import-title">Replace saved progress?</h2>
        <p>
          This will overwrite the included game statistics, saved hand, replays
          and training histories on this device. Export your current progress
          first if you want to keep it.
        </p>
        {pending && (
          <p>
            {pending.academy
              ? `${pending.academy.events.length} Academy events included. `
              : "Existing Academy data will be preserved. "}
            {pending.game.hands} simulated hands ·{" "}
            {pending.training.attempts.length} Phase 2 attempts ·{" "}
            {pending.postflop?.attempts.length ?? "preserve existing"} Phase 3
            attempts.{" "}
            {pending.review
              ? `${pending.review.observations.length} Review Studio observations included.`
              : "Existing Review Studio data will be preserved."}
          </p>
        )}
        <div className="backup-controls">
          <button
            autoFocus
            className="subtle-button"
            onClick={() => setPending(null)}
          >
            Cancel import
          </button>
          <button
            className="primary"
            onClick={() => {
              if (!pending) return;
              try {
                applyBackup(localStorage, pending, true);
                window.location.reload();
              } catch (err) {
                setMessage((err as Error).message);
                setPending(null);
              }
            }}
          >
            Confirm replacement
          </button>
        </div>
      </dialog>
    </section>
  );
}
