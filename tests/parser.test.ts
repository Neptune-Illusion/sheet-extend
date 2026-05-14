import { describe, it, expect } from "vitest";
import { parseAndMerge } from "../src/sheet/parser";
import { hasMergeMarkers } from "../src/sheet/detect";

describe("merge detection", () => {
  it("detects merge markers in markdown tables", () => {
    expect(hasMergeMarkers("| a | < |\n| --- | --- |")).toBe(true);
    expect(hasMergeMarkers("| a | b |\n| --- | --- |")).toBe(false);
  });
});

describe("parseAndMerge", () => {
  it("applies horizontal merges", () => {
    const parsed = parseAndMerge(`| A | < |\n| --- | --- |`);
    expect(parsed.grid[0][0].colspan).toBe(2);
    expect(parsed.grid[0][1].hidden).toBe(true);
  });

  it("applies vertical merges", () => {
    const parsed = parseAndMerge(`| A |\n| --- |\n| B |\n| ^ |`);
    expect(parsed.grid[1][0].rowspan).toBe(2);
    expect(parsed.grid[2][0].hidden).toBe(true);
  });
});
