import { describe, it, expect } from "vitest";
import { renderTable } from "../src/sheet/renderer";
import { parseAndMerge } from "../src/sheet/parser";

describe("renderTable", () => {
  it("does not create a ghost column for a final horizontal marker", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge("| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | < |");
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(3);
    expect(tableEl.querySelectorAll("tbody tr:last-child th, tbody tr:last-child td").length).toBe(2);
  });

  it("does not add columns when multiple horizontal and vertical markers overlap", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge("| A | B | C | D |\n| --- | --- | --- | --- |\n| 1 | 2 | < | < |\n| ^ | ^ | ^ | ^ |");
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(4);
  });

  it("creates a colgroup matching the number of logical columns", () => {
    const app = {} as any;
    const tableEl = document.createElement("table");
    const parsed = {
      grid: [
        [
          { text: "A", colspan: 2, rowspan: 1, hidden: false, isHeader: true },
          { text: "<", colspan: 1, rowspan: 1, hidden: true, isHeader: true },
        ],
        [
          { text: "B", colspan: 1, rowspan: 1, hidden: false, isHeader: false },
          { text: "C", colspan: 1, rowspan: 1, hidden: false, isHeader: false },
        ],
      ],
      alignments: ["left", "right"],
    } as any;

    renderTable(
      app,
      tableEl,
      parsed,
      "test.md",
      document.createElement("div") as any
    );

    expect(tableEl.querySelectorAll("colgroup col").length).toBe(2);
    expect(tableEl.querySelector("th")?.getAttribute("colspan")).toBe("2");
  });

  it("renders ^ merge across header/data boundary without thead/tbody split", () => {
    // Simulates: | 相关概念 | 1.外币 |
    //            | ---- | --- |
    //            | ^    | 2. 外币交易 |
    // After parseAndMerge: grid[0][0].rowspan=2, grid[1][0].hidden=true
    const app = {} as any;
    const tableEl = document.createElement("table");
    const parsed = {
      grid: [
        [
          { text: "相关概念", colspan: 1, rowspan: 2, hidden: false, isHeader: true },
          { text: "1.外币", colspan: 1, rowspan: 1, hidden: false, isHeader: true },
        ],
        [
          { text: "", colspan: 1, rowspan: 1, hidden: true, isHeader: false },
          { text: "2. 外币交易", colspan: 1, rowspan: 1, hidden: false, isHeader: false },
        ],
      ],
      alignments: ["default", "default"],
    } as any;

    renderTable(
      app,
      tableEl,
      parsed,
      "test.md",
      document.createElement("div") as any
    );

    // Should NOT have thead (because rowspan crosses header/data boundary)
    expect(tableEl.querySelector("thead")).toBeNull();
    // Should have a single tbody with all rows
    const tbody = tableEl.querySelector("tbody");
    expect(tbody).not.toBeNull();
    const rows = tbody!.querySelectorAll("tr");
    expect(rows.length).toBe(2);

    // First row: th with rowspan=2, th with normal content
    const firstRowCells = rows[0].querySelectorAll("th, td");
    expect(firstRowCells.length).toBe(2);
    expect(firstRowCells[0].getAttribute("rowspan")).toBe("2");

    // Second row: only one visible cell (the hidden one is skipped)
    const secondRowCells = rows[1].querySelectorAll("th, td");
    expect(secondRowCells.length).toBe(1);
  });

  it("does not create a ghost column for a final vertical marker", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge("| A | B |\n| --- | --- |\n| 1 | ^ |");
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(2);
    expect(tableEl.querySelectorAll("tbody tr:last-child th, tbody tr:last-child td").length).toBe(1);
  });

  it("does not create ghost columns when vertical markers span multiple rows", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge(
      "| A | B |\n| --- | --- |\n| 1 | 2 |\n| ^ | ^ |\n| ^ | ^ |"
    );
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(2);
    expect(tableEl.querySelectorAll("tbody tr").length).toBe(3);
    for (const tr of Array.from(tableEl.querySelectorAll("tbody tr"))) {
      expect(tr.querySelectorAll("th, td").length).toBeLessThanOrEqual(2);
    }
  });

  it("does not create a ghost column when header ends with a marker", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge("| A | B | < |\n| --- | --- | --- |\n| 1 | 2 | 3 |");
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(3);
    expect(tableEl.querySelectorAll("thead tr:first-child th").length).toBe(2);
  });

  it("does not create ghost columns in a single-column table with markers", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge("| A |\n| --- |\n| < |");
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(1);
  });

  it("does not create ghost columns when consecutive horizontal markers fill a row", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge("| A | B | C |\n| --- | --- | --- |\n| 1 | < | < |");
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(3);
    expect(tableEl.querySelectorAll("tbody tr:last-child th, tbody tr:last-child td").length).toBe(1);
  });

  it("keeps column count correct when a non-final cell is a horizontal marker", () => {
    const tableEl = document.createElement("table");
    const parsed = parseAndMerge("| A | B | C |\n| --- | --- | --- |\n| < | 2 | 3 |");
    renderTable({} as any, tableEl, parsed, "test.md", document.createElement("div") as any);
    expect(tableEl.querySelectorAll("colgroup col").length).toBe(3);
    // ponytail: < at col0 has no left neighbor, stays visible (stripped to empty)
    expect(tableEl.querySelectorAll("tbody tr:last-child th, tbody tr:last-child td").length).toBe(3);
  });

  it("uses normal thead/tbody when no rowspan crosses boundary", () => {
    const app = {} as any;
    const tableEl = document.createElement("table");
    const parsed = {
      grid: [
        [
          { text: "A", colspan: 1, rowspan: 1, hidden: false, isHeader: true },
          { text: "B", colspan: 1, rowspan: 1, hidden: false, isHeader: true },
        ],
        [
          { text: "C", colspan: 1, rowspan: 1, hidden: false, isHeader: false },
          { text: "D", colspan: 1, rowspan: 1, hidden: false, isHeader: false },
        ],
      ],
      alignments: ["default", "default"],
    } as any;

    renderTable(
      app,
      tableEl,
      parsed,
      "test.md",
      document.createElement("div") as any
    );

    // Should have separate thead and tbody
    expect(tableEl.querySelector("thead")).not.toBeNull();
    expect(tableEl.querySelector("tbody")).not.toBeNull();
  });
});
