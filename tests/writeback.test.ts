import { describe, expect, it } from "vitest";
import {
  applyMergeMarkers,
  clearMergeMarkers,
  findTableRangeAtLine,
  replaceTableRange,
} from "../src/sheet/writeback";

describe("markdown merge writeback", () => {
  it("writes horizontal merge markers across the selected row", () => {
    const table = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
    expect(applyMergeMarkers(table, {
      anchor: { row: 1, col: 0 },
      focus: { row: 1, col: 2 },
    }, "horizontal")).toBe("| A | B | C |\n| --- | --- | --- |\n| 1 | <!-- sheet-extend:merge-left --> | <!-- sheet-extend:merge-left --> |");
  });

  it("does not duplicate an existing horizontal merge marker to the right", () => {
    const table = "| A | B | C |\n| --- | --- | --- |\n| 1 | < | 3 |";
    expect(applyMergeMarkers(table, {
      anchor: { row: 1, col: 1 },
      focus: { row: 1, col: 2 },
    }, "horizontal")).toBe("| A | B | C |\n| --- | --- | --- |\n| 1 | < | 3 |");
  });

  it("writes vertical merge markers down the selected column", () => {
    const table = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    expect(applyMergeMarkers(table, {
      anchor: { row: 1, col: 0 },
      focus: { row: 2, col: 0 },
    }, "vertical")).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |\n| <!-- sheet-extend:merge-up --> | 4 |");
  });

  it("does not duplicate an existing vertical merge marker downward", () => {
    const table = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| ^ | 4 |\n| 5 | 6 |";
    expect(applyMergeMarkers(table, {
      anchor: { row: 2, col: 0 },
      focus: { row: 3, col: 0 },
    }, "vertical")).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |\n| ^ | 4 |\n| 5 | 6 |");
  });

  it("clears merge markers inside the selected range", () => {
    const table = "| A | B |\n| --- | --- |\n| 1 | < |\n| ^ | 4 |";
    expect(clearMergeMarkers(table, {
      anchor: { row: 1, col: 0 },
      focus: { row: 2, col: 1 },
    })).toBe("| A | B |\n| --- | --- |\n| 1 |  |\n|  | 4 |");
  });

  it("clears markers when the selected range covers a merged cell span", () => {
    const table = "| A | B | C |\n| --- | --- | --- |\n| 1 | < | < |";
    expect(clearMergeMarkers(table, {
      anchor: { row: 1, col: 0 },
      focus: { row: 1, col: 2 },
    })).toBe("| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |");
  });

  it("finds and replaces a table range in document text", () => {
    const doc = "before\n| A | B |\n| --- | --- |\n| 1 | 2 |\nafter";
    const range = findTableRangeAtLine(doc, 2);
    expect(range).toEqual({ startLine: 1, endLine: 3 });
    expect(replaceTableRange(doc, range!, "| X |\n| --- |")).toBe("before\n| X |\n| --- |\nafter");
  });

  it("preserves CRLF line endings when writing merge markers", () => {
    const table = "| A | B |\r\n| --- | --- |\r\n| 1 | 2 |";
    expect(applyMergeMarkers(table, {
      anchor: { row: 1, col: 0 },
      focus: { row: 1, col: 1 },
    }, "horizontal")).toBe("| A | B |\r\n| --- | --- |\r\n| 1 | <!-- sheet-extend:merge-left --> |");
  });

  it("preserves CRLF line endings when replacing a table range", () => {
    const doc = "before\r\n| A | B |\r\n| --- | --- |\r\n| 1 | 2 |\r\nafter";
    const range = findTableRangeAtLine(doc, 2);
    expect(range).toEqual({ startLine: 1, endLine: 3 });
    expect(replaceTableRange(doc, range!, "| X |\n| --- |")).toBe("before\r\n| X |\r\n| --- |\r\nafter");
  });
});
