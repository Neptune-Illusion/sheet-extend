import { describe, expect, it, vi } from "vitest";
import { writeTableUsingVault } from "../src/merge/interaction";
import { setTableAlignment } from "../src/sheet/table-style";
import type { TableAlignment } from "../src/sheet/table-style";

function makeVaultMock(docText: string) {
  let captured: string | null = null;
  const file = { path: "test.md" };
  const vault = {
    getAbstractFileByPath: vi.fn(() => file),
    process: vi.fn(async (f: any, cb: (text: string) => string) => {
      captured = cb(docText);
    }),
  };
  return { vault, getCaptured: () => captured };
}

const TABLE_DOC = "before\n| A | B |\n| --- | --- |\n| 1 | 2 |\nafter";

describe("table-style command integration", () => {
  for (const alignment of ["center", "left", "right"] as TableAlignment[]) {
    it(`writeTableUsingVault applies ${alignment} alignment to the separator row`, async () => {
      const { vault, getCaptured } = makeVaultMock(TABLE_DOC);
      const app = { vault } as any;
      const range = { startLine: 1, endLine: 3 };
      const selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } };

      const written = await writeTableUsingVault(
        app, "test.md", range, selection,
        (docText) => setTableAlignment(docText, alignment)
      );

      expect(written).toBe(true);
      const result = getCaptured();
      expect(result).not.toBeNull();
      const separator = result!.split("\n")[2];
      if (alignment === "center") {
        expect(separator).toBe("| :---: | :---: |");
      } else if (alignment === "left") {
        expect(separator).toBe("| :--- | :--- |");
      } else {
        expect(separator).toBe("| ---: | ---: |");
      }
      // Header and body unchanged
      expect(result!.split("\n")[1]).toBe("| A | B |");
      expect(result!.split("\n")[3]).toBe("| 1 | 2 |");
    });
  }

  it("writeTableUsingVault returns false when file not found", async () => {
    const vault = {
      getAbstractFileByPath: vi.fn(() => null),
      process: vi.fn(),
    };
    const app = { vault } as any;
    const range = { startLine: 0, endLine: 2 };
    const selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } };

    const written = await writeTableUsingVault(
      app, "missing.md", range, selection,
      (docText) => setTableAlignment(docText, "center")
    );

    expect(written).toBe(false);
    expect(vault.process).not.toHaveBeenCalled();
  });

  it("alignment preserves dash counts in the separator row through vault write-back", async () => {
    const docWithDashWidths = "before\n| A | B |\n| :--- | -----: |\n| 1 | 2 |\nafter";
    const { vault, getCaptured } = makeVaultMock(docWithDashWidths);
    const app = { vault } as any;
    const range = { startLine: 1, endLine: 3 };
    const selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } };

    await writeTableUsingVault(
      app, "test.md", range, selection,
      (docText) => {
        const lines = docText.split(/\r?\n/);
        const lineEnding = docText.includes("\r\n") ? "\r\n" : "\n";
        const tableText = lines.slice(range.startLine, range.endLine + 1).join(lineEnding);
        const aligned = setTableAlignment(tableText, "left");
        // Re-insert using replaceTableRange logic
        const allLines = docText.split(/\r?\n/);
        allLines.splice(range.startLine, range.endLine - range.startLine + 1, ...aligned.split(/\r?\n/));
        return allLines.join(lineEnding);
      }
    );

    const separator = getCaptured()!.split("\n")[2];
    // Left alignment: :--- and :----- (dash counts 3 and 5 preserved)
    expect(separator).toBe("| :--- | :----- |");
  });

  it("applies alignment only to the target table when multiple tables exist", async () => {
    const twoTables = [
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "| C | D |",
      "| --- | --- |",
      "| 3 | 4 |",
    ].join("\n");

    const { vault, getCaptured } = makeVaultMock(twoTables);
    const app = { vault } as any;
    // Target the second table (lines 4-6)
    const range = { startLine: 4, endLine: 6 };
    const selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } };

    await writeTableUsingVault(
      app, "test.md", range, selection,
      (docText) => {
        const lines = docText.split(/\r?\n/);
        const lineEnding = docText.includes("\r\n") ? "\r\n" : "\n";
        const tableText = lines.slice(range.startLine, range.endLine + 1).join(lineEnding);
        const aligned = setTableAlignment(tableText, "center");
        const allLines = docText.split(/\r?\n/);
        allLines.splice(range.startLine, range.endLine - range.startLine + 1, ...aligned.split(/\r?\n/));
        return allLines.join(lineEnding);
      }
    );

    const result = getCaptured()!.split("\n");
    // First table separator unchanged
    expect(result[1]).toBe("| --- | --- |");
    // Second table separator aligned to center
    expect(result[5]).toBe("| :---: | :---: |");
    // First table body unchanged
    expect(result[2]).toBe("| 1 | 2 |");
    // Second table body unchanged
    expect(result[6]).toBe("| 3 | 4 |");
  });
});