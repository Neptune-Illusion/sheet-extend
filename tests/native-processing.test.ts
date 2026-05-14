import { describe, it, expect } from "vitest";
import { hasMergeMarkers } from "../src/sheet/detect";

describe("native processing decision", () => {
  it("does not trigger re-render for plain tables", () => {
    expect(hasMergeMarkers("| A | B |\n| --- | --- |")).toBe(false);
  });

  it("triggers re-render for merge tables", () => {
    expect(hasMergeMarkers("| A | < |\n| --- | --- |")).toBe(true);
  });

  it("triggers re-render for vertical merges", () => {
    expect(hasMergeMarkers(`| A |\n| --- |\n| B |\n| ^ |`)).toBe(true);
  });
});
