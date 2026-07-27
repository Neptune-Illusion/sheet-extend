import { describe, expect, it } from "vitest";
import { runUnmergeCommand } from "../src/merge/interaction";

describe("merge context actions", () => {
  it("writes unmerge changes through the active editor", () => {
    let value = "before\n| A | B |\n| --- | --- |\n| 1 | ^ |\nafter";
    const editor = {
      getValue: () => value,
      replaceRange: (next: string) => { value = next; },
      setCursor: () => {},
    };
    const app = {
      workspace: {
        getActiveViewOfType: () => ({ editor }),
      },
    } as any;

    expect(runUnmergeCommand(
      app,
      { startLine: 1, endLine: 3 },
      { anchor: { row: 1, col: 0 }, focus: { row: 1, col: 1 } }
    )).toBe(true);
    expect(value).toContain("| 1 |  |");
    expect(value).not.toContain("^");
  });
});
