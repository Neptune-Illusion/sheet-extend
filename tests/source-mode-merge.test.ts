import { describe, expect, it } from "vitest";
// @ts-ignore Test the source-mode DOM enhancement without constructing an Obsidian plugin.
import SheetExtendPlugin from "../main.ts";

function applySourceModePreview(table: HTMLTableElement, markdown: string): void {
  const prototype = SheetExtendPlugin.prototype as any;
  const context = {
    addCellCoordinates: prototype.addCellCoordinates,
    parsedTableHasRowspanAcrossDomSections: prototype.parsedTableHasRowspanAcrossDomSections,
  };
  prototype.applyMergePreviewToExistingTable.call(context, table, markdown);
}

function nativeTable(): HTMLTableElement {
  const table = document.createElement("table");
  table.innerHTML =
    "<thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>" +
    "<tbody><tr><td>1</td><td>2</td><td>^</td></tr></tbody>";
  return table;
}

describe("Live Preview source-mode merge enhancement", () => {
  it("hides a horizontal marker cell after applying colspan", () => {
    const table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>" +
      "<tbody><tr><td>1</td><td>2</td><td>&lt;</td></tr></tbody>";
    applySourceModePreview(table, "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | < |");

    const row = table.rows[1];
    expect(row.cells[1].colSpan).toBe(2);
    expect(row.cells[2].hidden).toBe(true);
    expect(row.cells[2].style.display).toBe("none");
  });

  it("flattens sections so a vertical merge keeps its rowspan", () => {
    const table = nativeTable();
    applySourceModePreview(table, "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | ^ |");

    expect(table.tHead).toBeNull();
    expect(table.tBodies).toHaveLength(1);
    expect(table.rows[0].cells[2].rowSpan).toBe(2);
    expect(table.rows[1].cells[2].hidden).toBe(true);
  });
});
