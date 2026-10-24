import { describe, it, expect, vi, afterEach } from "vitest";
import { emptyProgress, loadProgress } from "../lib/progress";
afterEach(() => vi.unstubAllGlobals());
describe("saved training progress", () => {
  it("restores valid progress", () => {
    const p = {
      ...emptyProgress,
      hands: 4,
      wins: 2,
      lessons: ["position"],
      decisions: [
        { hand: 1, street: "Flop", action: "check", position: "BTN" },
      ],
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(p) });
    expect(loadProgress()).toEqual(p);
  });
  it.each([
    "not json",
    "null",
    "{}",
    '{"version":1,"hands":9007199254740992,"wins":0,"decisions":[],"lessons":[]}',
    '{"version":1,"hands":2,"wins":0,"decisions":[null],"lessons":[]}',
    '{"version":1,"hands":-4}',
    '{"version":1,"hands":1,"wins":5,"decisions":[],"lessons":[]}',
  ])("safely handles corrupt data %s", (value) => {
    vi.stubGlobal("localStorage", { getItem: () => value });
    expect(loadProgress()).toEqual(emptyProgress);
  });
  it("handles browser storage denial", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("denied");
      },
    });
    expect(loadProgress()).toEqual(emptyProgress);
  });
});
