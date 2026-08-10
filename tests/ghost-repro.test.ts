import { describe, expect, it } from "vitest";
import { parseAndMerge } from "../src/sheet/parser";
import { renderTable } from "../src/sheet/renderer";

// Repro for the user-reported ghost column: a trailing < or ^ pushes the last
// cell out of the table. Checks the rendered DOM occupies a full rectangle.
function render(markdown: string): HTMLTableElement {
  const tableEl = document.createElement("table");
  renderTable(
    {} as any,
    tableEl,
    parseAndMerge(markdown),
    "note.md",
    document.createElement("div") as any
  );
  return tableEl;
}

function gridWidths(tableEl: HTMLTableElement): number[] {
  const rows = Array.from(tableEl.rows);
  const occupied: number[] = new Array(rows.length).fill(0);
  rows.forEach((row, r) => {
    Array.from(row.cells).forEach((cell) => {
      const cs = cell.colSpan || 1;
      const rs = cell.rowSpan || 1;
      for (let dr = 0; dr < rs && r + dr < rows.length; dr++) {
        occupied[r + dr] += cs;
      }
    });
  });
  return occupied;
}

describe("ghost column repro", () => {
  const cases: Record<string, string> = {
    "trailing horizontal marker": "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | < |",
    "trailing vertical marker": "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | ^ |",
    "trailing vertical marker two cols": "| A | B |\n| --- | --- |\n| 1 | ^ |",
    "middle horizontal marker": "| A | B | C |\n| --- | --- | --- |\n| 1 | < | 3 |",
    "both markers same row": "| A | B | C |\n| --- | --- | --- |\n| 1 | < | ^ |",
    "trailing marker no padding": "| A | B | C |\n|---|---|---|\n| 1 | 2 |^|",
  };

  for (const [name, markdown] of Object.entries(cases)) {
    it(`renders a full rectangle for ${name}`, () => {
      const tableEl = render(markdown);
      const cols = tableEl.querySelectorAll("colgroup col").length;
      const widths = gridWidths(tableEl);
      // Every row must occupy exactly the same number of grid columns,
      // otherwise the browser pushes the surplus cell outside the table.
      const unique = Array.from(new Set(widths));
      expect(unique, `row widths ${JSON.stringify(widths)}, colgroup ${cols}`).toHaveLength(1);
      expect(cols, `colgroup ${cols} vs row width ${unique[0]}`).toBe(unique[0]);
    });
  }
});
