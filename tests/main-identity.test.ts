import { describe, expect, it } from "vitest";
// @ts-ignore Vitest must load the TypeScript source rather than generated main.js.
import { applyPostProcessorIdentity } from "../main.ts";

describe("reading mode table identity", () => {
  it("assigns source path and stable ordinal without an active editor view", () => {
    const table = document.createElement("table");
    applyPostProcessorIdentity(table, "notes/example.md", 2);
    expect(table.getAttribute("data-source-path")).toBe("notes/example.md");
    expect(table.getAttribute("data-line-start")).toBeNull();
    expect(table.dataset.sheetExtendTableOrdinal).toBe("2");
  });
});
