import { describe, expect, it } from "vitest";
import { applyFormulas } from "../src/sheet/formulas";
import { parseAndMerge } from "../src/sheet/parser";

describe("table formulas", () => {
  it("renders supported column formulas", () => {
    const parsed = applyFormulas(parseAndMerge([
      "| Item | Amount |",
      "| --- | ---: |",
      "| A | 10 |",
      "| B | 20 |",
      "| Total | =sum |",
      "| Average | =avg |",
      "| Count | =count |",
    ].join("\n")));

    expect(parsed.grid[3][1].text).toBe("30");
    expect(parsed.grid[4][1].text).toBe("15");
    expect(parsed.grid[5][1].text).toBe("2");
  });

  it("leaves empty results when numeric formulas have no values", () => {
    const parsed = applyFormulas(parseAndMerge("| A |\n| --- |\n| text |\n| =max |"));
    expect(parsed.grid[2][0].text).toBe("");
  });
});
