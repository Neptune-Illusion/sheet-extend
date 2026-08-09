import { describe, expect, it, vi } from "vitest";
import { resolveTableRangeFromVault, writeTableUsingVault } from "../src/merge/interaction";
import { setTableAlignment } from "../src/sheet/table-style";
import type { TableAlignment } from "../src/sheet/table-style";

const TWO_TABLES_DOC = [
  "| A | B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "| C | D |",
  "| --- | --- |",
  "| 3 | 4 |",
].join("\n");

function makeVaultMock(docText: string) {
  const file = { path: "test.md" };
  const vault = {
    getAbstractFileByPath: vi.fn(() => file),
    read: vi.fn(async () => docText),
    process: vi.fn(async (f: any, cb: (text: string) => string) => cb(docText)),
  };
  return { vault, file };
}

function makeTableWithOrdinal(ordinal: number, sourcePath = "test.md"): HTMLTableElement {
  const tableEl = document.createElement("table");
  const header = ordinal === 1 ? ["C", "D"] : ["A", "B"];
  const body = ordinal === 1 ? ["3", "4"] : ["1", "2"];
  tableEl.innerHTML = `<thead><tr><th>${header[0]}</th><th>${header[1]}</th></tr></thead><tbody><tr><td>${body[0]}</td><td>${body[1]}</td></tr></tbody>`;
  tableEl.setAttribute("data-source-path", sourcePath);
  tableEl.dataset.sheetExtendTableOrdinal = String(ordinal);
  return tableEl;
}

describe("resolveTableRangeFromVault", () => {
  it("resolves the range by ordinal for the second table", async () => {
    const { vault } = makeVaultMock(TWO_TABLES_DOC);
    const app = { vault } as any;
    const tableEl = makeTableWithOrdinal(1);

    const range = await resolveTableRangeFromVault(app, tableEl);

    expect(range).not.toBeNull();
    expect(range!.startLine).toBe(4);
    expect(range!.endLine).toBe(6);
  });

  it("resolves the range for the first table when ordinal is 0", async () => {
    const { vault } = makeVaultMock(TWO_TABLES_DOC);
    const app = { vault } as any;
    const tableEl = makeTableWithOrdinal(0);

    const range = await resolveTableRangeFromVault(app, tableEl);

    expect(range).not.toBeNull();
    expect(range!.startLine).toBe(0);
    expect(range!.endLine).toBe(2);
  });

  it("returns null when neither ordinal nor unique DOM content identifies the table", async () => {
    const { vault } = makeVaultMock(TWO_TABLES_DOC);
    const app = { vault } as any;
    const tableEl = document.createElement("table");
    tableEl.setAttribute("data-source-path", "test.md");

    const range = await resolveTableRangeFromVault(app, tableEl);

    expect(range).toBeNull();
  });

  it("returns null when sourcePath is missing", async () => {
    const { vault } = makeVaultMock(TWO_TABLES_DOC);
    const app = { vault } as any;
    const tableEl = document.createElement("table");

    const range = await resolveTableRangeFromVault(app, tableEl);

    expect(range).toBeNull();
  });

  it("returns null when file not found in vault", async () => {
    const vault = {
      getAbstractFileByPath: vi.fn(() => null),
      read: vi.fn(),
    };
    const app = { vault } as any;
    const tableEl = makeTableWithOrdinal(0);

    const range = await resolveTableRangeFromVault(app, tableEl);

    expect(range).toBeNull();
  });

  it("returns null when vault has no read method", async () => {
    const vault = {
      getAbstractFileByPath: vi.fn(() => ({ path: "test.md" })),
    };
    const app = { vault } as any;
    const tableEl = makeTableWithOrdinal(0);

    const range = await resolveTableRangeFromVault(app, tableEl);

    expect(range).toBeNull();
  });
});

describe("range fallback alignment integration", () => {
  it("aligns the correct table when range is resolved from vault by ordinal", async () => {
    let capturedDoc: string | null = null;
    const vault = {
      getAbstractFileByPath: vi.fn(() => ({ path: "test.md" })),
      read: vi.fn(async () => TWO_TABLES_DOC),
      process: vi.fn(async (f: any, cb: (text: string) => string) => {
        capturedDoc = cb(TWO_TABLES_DOC);
      }),
    };
    const app = { vault } as any;
    const tableEl = makeTableWithOrdinal(1);

    const range = await resolveTableRangeFromVault(app, tableEl);
    expect(range).not.toBeNull();

    // Simulate what applyTableAlignment does with the resolved range
    const written = await writeTableUsingVault(
      app, "test.md", range!,
      { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } },
      (docText) => {
        const lines = docText.split(/\r?\n/);
        const lineEnding = docText.includes("\r\n") ? "\r\n" : "\n";
        const tableText = lines.slice(range!.startLine, range!.endLine + 1).join(lineEnding);
        const aligned = setTableAlignment(tableText, "center");
        const allLines = docText.split(/\r?\n/);
        allLines.splice(range!.startLine, range!.endLine - range!.startLine + 1, ...aligned.split(/\r?\n/));
        return allLines.join(lineEnding);
      }
    );

    expect(written).toBe(true);
    expect(capturedDoc).not.toBeNull();
    const lines = capturedDoc!.split("\n");
    // First table separator unchanged
    expect(lines[1]).toBe("| --- | --- |");
    // Second table separator centered
    expect(lines[5]).toBe("| :---: | :---: |");
  });

  for (const alignment of ["center", "left", "right"] as TableAlignment[]) {
    it(`alignment through vault fallback preserves dash counts for ${alignment}`, async () => {
      const docWithDashWidths = "before\n| A | B |\n| :--- | -----: |\n| 1 | 2 |\nafter";
      const vault = {
        getAbstractFileByPath: vi.fn(() => ({ path: "test.md" })),
        read: vi.fn(async () => docWithDashWidths),
        process: vi.fn(async (f: any, cb: (text: string) => string) => {
          cb(docWithDashWidths);
        }),
      };
      const app = { vault } as any;
      const tableEl = makeTableWithOrdinal(0, "test.md");

      const range = await resolveTableRangeFromVault(app, tableEl);
      expect(range).not.toBeNull();
      expect(range!.startLine).toBe(1);
      expect(range!.endLine).toBe(3);

      // Verify the dash counts are preserved by setTableAlignment on the slice
      const tableText = docWithDashWidths.split("\n").slice(1, 4).join("\n");
      const aligned = setTableAlignment(tableText, alignment);
      const separator = aligned.split("\n")[1];
      const cells = separator.split("|").slice(1, -1).map((c: string) => c.trim());

      if (alignment === "left") {
        expect(cells[0]).toMatch(/^:---$/);   // 3 dashes
        expect(cells[1]).toMatch(/^:-----$/); // 5 dashes
      } else if (alignment === "right") {
        expect(cells[0]).toMatch(/^---:$/);
        expect(cells[1]).toMatch(/^-----:$/);
      } else {
        expect(cells[0]).toMatch(/^:---:$/);
        expect(cells[1]).toMatch(/^:-----:$/);
      }
    });
  }
});
