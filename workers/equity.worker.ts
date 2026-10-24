import {
  runEquity,
  type EquityInput,
  type EquityProgress,
  type EquityResult,
} from "../lib/equity/engine";
export type WorkerRequest = { id: number; input: EquityInput };
export type WorkerResponse =
  | { id: number; type: "progress"; progress: EquityProgress }
  | { id: number; type: "result"; result: EquityResult }
  | { id: number; type: "error"; message: string };
const worker = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (value: WorkerResponse) => void;
};
worker.onmessage = async ({ data }) => {
  try {
    let last = -Infinity;
    const result = await runEquity(data.input, {
      onProgress: (p) => {
        const now = performance.now();
        if (now - last > 80 || p.completed === p.total) {
          worker.postMessage({ id: data.id, type: "progress", progress: p });
          last = now;
        }
      },
    });
    worker.postMessage({ id: data.id, type: "result", result });
  } catch (error) {
    worker.postMessage({
      id: data.id,
      type: "error",
      message: error instanceof Error ? error.message : "Calculation failed.",
    });
  }
};
