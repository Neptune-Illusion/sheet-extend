import { describe, expect, it, vi } from "vitest";
import { resolveTableIdentityFromVault, resolveTableRangeFromVault, runUnmergeCommand, writeTableUsingVault } from "../src/merge/interaction";

describe("merge interaction vault fallback", () => {
  it("writes an unmerge when no editor is available", async () => {
    let content = "| A | B |\n| --- | --- |\n| 1 | < |";
    const process = vi.fn(async (_file: unknown, callback: (text: string) => string) => {
      content = callback(content);
      return content;
    });
    const app = {
      workspace: { getActiveViewOfType: () => null },
      vault: {
        getAbstractFileByPath: (path: string) => ({ path }),
        process,
      },
    } as any;

    const written = await writeTableUsingVault(
      app,
      "note.md",
      { startLine: 0, endLine: 2 },
      { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } },
      (documentText, range, selection) => {
        expect(range.startLine).toBe(0);
        expect(selection.anchor.col).toBe(1);
        return documentText.replace("<", "");
      }
    );

    expect(written).toBe(true);
    expect(content).toContain("| 1 |  |");
    expect(process).toHaveBeenCalledOnce();
  });

  it("returns success and writes through vault when runUnmergeCommand has no editor", async () => {
    let content = "| A | B |\n| --- | --- |\n| 1 | < |";
    const app = {
      workspace: {
        getActiveViewOfType: () => null,
        getActiveFile: () => ({ path: "note.md" }),
      },
      vault: {
        getAbstractFileByPath: () => ({ path: "note.md" }),
        process: async (_file: unknown, callback: (text: string) => string) => {
          content = callback(content);
          return content;
        },
      },
    } as any;

    expect(runUnmergeCommand(app, { startLine: 0, endLine: 2 }, {
      anchor: { row: 1, col: 1 },
      focus: { row: 1, col: 1 },
    })).toBe(true);
    await Promise.resolve();
    expect(content).toContain("| 1 |  |");
  });

  it("matches a detached rendered table to its file-global range", async () => {
    const doc = "before\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n| C | D |\n| --- | --- |\n| 3 | 4 |";
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>";
    table.setAttribute("data-source-path", "note.md");
    const app = {
      vault: {
        getAbstractFileByPath: () => ({ path: "note.md" }),
        read: async () => doc,
      },
    } as any;
    const identity = await resolveTableIdentityFromVault(app, table);
    expect(identity?.range.startLine).toBe(1);
    expect(await resolveTableRangeFromVault(app, table)).toEqual({ startLine: 1, endLine: 3 });
  });

  it("rejects ambiguous identical tables instead of choosing the first", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n| A | B |\n| --- | --- |\n| 1 | 2 |";
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>";
    table.setAttribute("data-source-path", "note.md");
    const app = { vault: { getAbstractFileByPath: () => ({}), read: async () => doc } } as any;
    expect(await resolveTableIdentityFromVault(app, table)).toBeNull();
  });
});
