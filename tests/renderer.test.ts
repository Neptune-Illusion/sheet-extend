import { describe, it, expect } from "vitest";
import { renderTable } from "../src/sheet/renderer";

describe("renderTable", () => {
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
