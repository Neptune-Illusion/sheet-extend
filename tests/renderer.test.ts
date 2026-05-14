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
});
