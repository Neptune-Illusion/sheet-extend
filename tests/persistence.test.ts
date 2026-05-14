import { describe, it, expect } from "vitest";
import { getTableId } from "../src/resizer/persistence";

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
});
