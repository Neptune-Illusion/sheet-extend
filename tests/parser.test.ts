import { describe, it, expect } from "vitest";
import { parseAndMerge } from "../src/sheet/parser";
import { hasMergeMarkers } from "../src/sheet/detect";

describe("merge detection", () => {
  it("detects merge markers in markdown tables", () => {
    expect(hasMergeMarkers("| a | < |\n| --- | --- |")).toBe(true);
    expect(hasMergeMarkers("| a | b |\n| --- | --- |")).toBe(false);
  });

  it("detects hidden merge marker comments", () => {
    expect(hasMergeMarkers("| a | <!-- sheet-extend:merge-left --> |\n| --- | --- |")).toBe(true);
    expect(hasMergeMarkers("| a |\n| --- |\n| b |\n| <!-- sheet-extend:merge-up --> |")).toBe(true);
  });

  it("detects ^ vertical merge marker", () => {
    expect(hasMergeMarkers("| a |\n| --- |\n| b |\n| ^ |")).toBe(true);
  });

  it("does NOT treat HTML tags as merge markers", () => {
    // <font> tag should not trigger merge detection
    expect(hasMergeMarkers('| <font color="#ff0000">text</font> | b |\n| --- | --- |')).toBe(false);
    // <br> tag should not trigger merge detection
    expect(hasMergeMarkers("| a<br>b | c |\n| --- | --- |")).toBe(false);
    // </font> closing tag
    expect(hasMergeMarkers("| </font> | b |\n| --- | --- |")).toBe(false);
    // <span> tag
    expect(hasMergeMarkers('| <span style="color:red">x</span> | y |\n| --- | --- |')).toBe(false);
    // <a> tag
    expect(hasMergeMarkers('| <a href="url">link</a> | b |\n| --- | --- |')).toBe(false);
  });

  it("does NOT treat < inside HTML content as merge marker", () => {
    // Complex HTML with multiple tags
    const text = '| 条件 | <font color="#ff0000">同时符合</font> |\n| --- | --- |\n| 1 | <br>内容 |';
    expect(hasMergeMarkers(text)).toBe(false);
  });

  it("still detects real merge markers alongside HTML", () => {
    // Table with both HTML and a real merge marker
    const text = '| <font color="red">A</font> | < |\n| --- | --- |';
    expect(hasMergeMarkers(text)).toBe(true);
  });
});

describe("parseAndMerge", () => {
  it("applies horizontal merges", () => {
    const parsed = parseAndMerge(`| A | < |\n| --- | --- |`);
    expect(parsed.grid[0][0].colspan).toBe(2);
    expect(parsed.grid[0][1].hidden).toBe(true);
  });

  it("applies horizontal merges in body rows", () => {
    const parsed = parseAndMerge(`| A | B |\n| --- | --- |\n| left | < |`);
    expect(parsed.grid[1][0].colspan).toBe(2);
    expect(parsed.grid[1][1].hidden).toBe(true);
  });

  it("applies hidden horizontal merge markers", () => {
    const parsed = parseAndMerge(`| A | B |\n| --- | --- |\n| left | <!-- sheet-extend:merge-left --> |`);
    expect(parsed.grid[1][0].colspan).toBe(2);
    expect(parsed.grid[1][1].hidden).toBe(true);
  });

  it("applies vertical merges", () => {
    const parsed = parseAndMerge(`| A |\n| --- |\n| B |\n| ^ |`);
    expect(parsed.grid[1][0].rowspan).toBe(2);
    expect(parsed.grid[2][0].hidden).toBe(true);
  });

  it("applies hidden vertical merge markers", () => {
    const parsed = parseAndMerge(`| A |\n| --- |\n| B |\n| <!-- sheet-extend:merge-up --> |`);
    expect(parsed.grid[1][0].rowspan).toBe(2);
    expect(parsed.grid[2][0].hidden).toBe(true);
  });

  it("preserves HTML tags in cell content (does not strip < from HTML)", () => {
    const input = '| Header |\n| --- |\n| <font color="#ff0000">重要</font> |';
    const parsed = parseAndMerge(input);
    // The cell text must retain the full HTML tags
    expect(parsed.grid[1][0].text).toBe('<font color="#ff0000">重要</font>');
  });

  it("preserves <br> tags in cell content", () => {
    const input = '| Header |\n| --- |\n| 第一行<br>第二行 |';
    const parsed = parseAndMerge(input);
    expect(parsed.grid[1][0].text).toBe('第一行<br>第二行');
  });

  it("preserves ^ character when part of larger content", () => {
    const input = '| Header |\n| --- |\n| x^2 + y^2 |';
    const parsed = parseAndMerge(input);
    expect(parsed.grid[1][0].text).toBe('x^2 + y^2');
  });
});
