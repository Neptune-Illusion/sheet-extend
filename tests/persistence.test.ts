import { describe, it, expect, vi } from "vitest";
import { getTableId, getTableIds, loadWidths, saveWidths } from "../src/resizer/persistence";

describe("getTableId", () => {
  it("prefers source path and section line when available", () => {
    const table = document.createElement("table");
    table.setAttribute("data-source-path", "notes/demo.md");
    table.setAttribute("data-line-start", "12");
    expect(getTableId(table)).toContain("notes/demo.md");
    expect(getTableId(table)).toContain("12");
  });

  it("keeps the same id when a sourced table is re-rendered with different text", () => {
    const table = document.createElement("table");
    table.setAttribute("data-source-path", "notes/demo.md");
    table.setAttribute("data-line-start", "12");
    table.textContent = "Before";
    const before = getTableId(table);

    table.textContent = "After";

    expect(getTableId(table)).toBe(before);
  });

  it("provides source-line and ordinal aliases for the same table", () => {
    const table = document.createElement("table");
    table.setAttribute("data-source-path", "notes/demo.md");
    table.setAttribute("data-line-start", "12");
    table.dataset.sheetExtendTableOrdinal = "2";
    table.textContent = "Hello World";

    expect(getTableIds(table)).toEqual([
      "table-notes/demo.md-12",
      "table-notes/demo.md-ordinal-2",
      "table-fallback-Hello_World",
    ]);
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

  it("does not let fallback id pollute widths across tables with the same text", () => {
    const saveData = vi.fn();
    const plugin = {
      settings: {},
      widthStore: {},
      saveData,
    } as any;

    const tableA = document.createElement("table");
    tableA.setAttribute("data-source-path", "notes/demo.md");
    tableA.setAttribute("data-line-start", "5");
    tableA.textContent = "Hello World";

    const tableB = document.createElement("table");
    tableB.setAttribute("data-source-path", "notes/demo.md");
    tableB.setAttribute("data-line-start", "20");
    tableB.textContent = "Hello World";

    const idsA = getTableIds(tableA);
    const idsB = getTableIds(tableB);
    expect(idsA[idsA.length - 1]).toBe(idsB[idsB.length - 1]);

    saveWidths(plugin, idsA, [120, 80]);

    expect(loadWidths(plugin, idsB)).toBeNull();
    expect(saveData).toHaveBeenCalledWith(
      expect.objectContaining({
        columnWidths: expect.not.objectContaining({
          [idsA[idsA.length - 1]]: expect.anything(),
        }),
      })
    );
  });

  it("still reads widths stored under fallback id for backward compatibility", () => {
    const saveData = vi.fn();
    const plugin = {
      settings: {},
      widthStore: {
        "table-fallback-Hello_World": [120, 80],
      },
      saveData,
    } as any;

    expect(loadWidths(plugin, "table-fallback-Hello_World")).toEqual([120, 80]);
  });
});
