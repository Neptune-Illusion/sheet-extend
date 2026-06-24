import { describe, expect, it } from "vitest";
import {
  buildSeparatorLineForWidths,
  buildSeparatorLine,
  extractMarkdownTableSpecs,
  matchMarkdownTableSpecForElement,
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

  it("preserves CRLF line endings when updating separator widths", () => {
    const doc = "before\r\n| A | B |\r\n| --- | --- |\r\n| 1 | 2 |\r\nafter";
    const next = updateSeparatorLineForWidths(
      doc,
      { startLine: 1, endLine: 3 },
      [80, 120],
      8
    );

    expect(next).toBe("before\r\n| A | B |\r\n| ---------- | --------------- |\r\n| 1 | 2 |\r\nafter");
  });

  it("builds a replacement separator line without rewriting the whole document", () => {
    expect(buildSeparatorLineForWidths("| :--- | ---: |", [32, 48], 8)).toBe("| :---- | ------: |");
  });

  it("matches repeated headers by body/content signature instead of first header occurrence", () => {
    const doc = [
      "| Name | Value |",
      "| --- | --- |",
      "| alpha | 1 |",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| beta | 2 |",
    ].join("\n");
    const specs = extractMarkdownTableSpecs(doc);
    const table = document.createElement("table");
    table.innerHTML = "<tr><th>Name</th><th>Value</th></tr><tr><td>beta</td><td>2</td></tr>";

    expect(matchMarkdownTableSpecForElement(specs, table)?.range).toEqual({ startLine: 4, endLine: 6 });
  });

  it("normalizes markdown formatting when matching rendered tables", () => {
    const doc = "| **Name** | `Value` |\n| --- | --- |\n| [[alpha]] | 1 |";
    const specs = extractMarkdownTableSpecs(doc);
    const table = document.createElement("table");
    table.innerHTML = "<tr><th>Name</th><th>Value</th></tr><tr><td>alpha</td><td>1</td></tr>";

    expect(matchMarkdownTableSpecForElement(specs, table)?.range).toEqual({ startLine: 0, endLine: 2 });
  });
});
