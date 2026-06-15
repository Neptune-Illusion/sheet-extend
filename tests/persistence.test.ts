import { describe, it, expect, vi } from "vitest";
import { getTableId, saveWidths } from "../src/resizer/persistence";

describe("getTableId", () => {
  it("prefers source path and section line when available", () => {
    const table = document.createElement("table");
    table.setAttribute("data-source-path", "notes/demo.md");
    table.setAttribute("data-line-start", "12");
    expect(getTableId(table)).toContain("notes/demo.md");
    expect(getTableId(table)).toContain("12");
  });

  it("falls back for tables without attributes", () => {
    const table = document.createElement("table");
    table.textContent = "Hello World";
    const id = getTableId(table);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("saves widths with the current data schema version", () => {
    const saveData = vi.fn();
    const plugin = {
      settings: {},
      widthStore: {},
      saveData,
    } as any;

    saveWidths(plugin, "table-demo", [120, null]);

    expect(saveData).toHaveBeenCalledWith({
      version: "1.3.0",
      settings: {},
      columnWidths: { "table-demo": [120, null] },
    });
  });
});
