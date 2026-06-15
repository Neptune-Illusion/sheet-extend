import { describe, expect, it } from "vitest";
import {
  buildSeparatorLine,
  extractMarkdownTableSpecs,
  parseSeparatorLine,
  updateSeparatorLineForWidths,
} from "../src/sheet/markdown-table";

describe("markdown table specs", () => {
  it("extracts table specs with separator widths and alignment", () => {
    const specs = extractMarkdownTableSpecs("| A | B |\n| :--- | -----: |\n| 1 | 2 |");

    expect(specs).toHaveLength(1);
    expect(specs[0].range).toEqual({ startLine: 0, endLine: 2 });
    expect(specs[0].columns).toEqual([
      { alignLeft: true, alignRight: false, dashCount: 3 },
      { alignLeft: false, alignRight: true, dashCount: 5 },
    ]);
  });

  it("preserves alignment when building separator rows", () => {
    const columns = parseSeparatorLine("| :--- | ---: | :---: |")!;
    expect(buildSeparatorLine(columns, [4, 5, 6])).toBe("| :---- | -----: | :------: |");
  });

  it("updates separator dash counts from pixel widths", () => {
    const doc = "before\n| A | B |\n| --- | ---: |\n| 1 | 2 |\nafter";
    const next = updateSeparatorLineForWidths(
      doc,
      { startLine: 1, endLine: 3 },
      [80, 120],
      8
    );

    expect(next).toBe("before\n| A | B |\n| ---------- | ---------------: |\n| 1 | 2 |\nafter");
  });
});
