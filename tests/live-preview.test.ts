import { describe, expect, it } from "vitest";
import { parseAndMerge } from "../src/sheet/parser";
import { applyLivePreviewMerge } from "../src/sheet/live-preview";

function nativeTable(html: string): HTMLTableElement {
  const table = document.createElement("table");
  table.innerHTML = html;
  document.body.appendChild(table);
  return table;
}

describe("Live Preview native table integration", () => {
  it("flattens thead/tbody before applying a cross-boundary vertical merge", () => {
    const table = nativeTable(
      "<thead><tr><th>A</th><th>B</th></tr></thead>" +
      "<tbody><tr><td>^</td><td>value</td></tr></tbody>"
    );
    const parsed = parseAndMerge("| A | B |\n| --- | --- |\n| ^ | value |");

    expect(applyLivePreviewMerge(table, parsed)).toBe(true);
    expect(table.tHead).toBeNull();
    expect(table.tBodies[0].rows.length).toBe(2);
    expect(table.rows[0].cells[0].rowSpan).toBe(2);
    expect(Array.from(table.rows[1].cells).filter((cell) => cell.style.display !== "none").length).toBe(1);
    expect(table.rows[1].cells[1].textContent).toBe("value");
    expect(table.textContent).not.toContain("^");
  });

  it("materializes missing cells so short rows cannot float into a new column", () => {
    const table = nativeTable(
      "<thead><tr><th>ddd</th><th></th></tr></thead>" +
      "<tbody><tr><td>gggggg</td><td></td></tr><tr><td></td><td></td><td>^</td></tr></tbody>"
    );
    const parsed = parseAndMerge(
      "| ddd | | |\n| --- | --- | --- |\n| gggggg | | |\n| | | ^ |"
    );

    applyLivePreviewMerge(table, parsed);
    expect(table.rows[0].cells.length).toBe(3);
    expect(table.rows[1].cells.length).toBe(3);
    expect(table.rows[2].cells.length).toBe(3);
    expect(table.rows[2].cells[2].style.display).toBe("none");
    expect(Array.from(table.rows).every((row) => row.cells.length === 3)).toBe(true);
  });

  it("handles empty cells and horizontal markers without exposing marker text", () => {
    const table = nativeTable(
      "<thead><tr><th>left</th><th>&lt;</th><th>right</th></tr></thead>" +
      "<tbody><tr><td></td><td>body</td><td></td></tr></tbody>"
    );
    const parsed = parseAndMerge("| left | < | right |\n| --- | --- | --- |\n| | body | |");

    applyLivePreviewMerge(table, parsed);
    expect(table.rows[0].cells[0].colSpan).toBe(2);
    expect(table.rows[0].cells[1].style.display).toBe("none");
    expect(table.textContent).not.toContain("<");
  });

  it("clears rejected partial rectangle markers without removing their cells", () => {
    const table = nativeTable(
      "<thead><tr><th></th><th>&lt;</th><th></th></tr></thead>" +
      "<tbody><tr><td></td><td>^</td><td></td></tr></tbody>"
    );
    const parsed = parseAndMerge("| | < | |\n| --- | --- | --- |\n| | ^ | |");

    applyLivePreviewMerge(table, parsed);
    expect(table.rows[0].cells[0].colSpan).toBe(2);
    expect(table.rows[0].cells[0].rowSpan).toBe(1);
    expect(table.rows[1].cells[1].style.display).not.toBe("none");
    expect(table.rows[1].cells[1].textContent).toBe("");
    expect(table.textContent).not.toContain("^");
  });
});
