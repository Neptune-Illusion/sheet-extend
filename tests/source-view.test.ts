import { describe, expect, it } from "vitest";
import { selectSourceView } from "../src/sheet/source-view";

describe("source view selection", () => {
  it("selects a non-active markdown view by source path", () => {
    const active = { file: { path: "active.md" } };
    const other = { file: { path: "other.md" } };
    expect(selectSourceView(active, [{ view: other }], "other.md")).toBe(other);
  });

  it("keeps the active view for its own source and returns null when absent", () => {
    const active = { file: { path: "active.md" } };
    expect(selectSourceView(active, [], "active.md")).toBe(active);
    expect(selectSourceView(active, [], "missing.md")).toBeNull();
  });
});
