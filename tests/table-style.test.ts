import { describe, expect, it } from "vitest";
import {
  setColumnAlignment,
  setColumnsAlignment,
  setMixedColumnsAlignment,
  setTableAlignment,
} from "../src/sheet/table-style";

function extractSeparator(table: string): string {
  return table.split(/\r?\n/)[1];
}

describe("table-style alignment", () => {
  it("centers all columns in a table", () => {
    const input = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const output = setTableAlignment(input, "center");
    expect(extractSeparator(output)).toBe("| :---: | :---: |");
  });

  it("left-aligns a single column while leaving others unchanged", () => {
    const input = "| A | B | C |\n| --- | ---: | :---: |\n| 1 | 2 | 3 |";
    const output = setColumnAlignment(input, 1, "left");
    expect(extractSeparator(output)).toBe("| --- | :--- | :---: |");
  });

  it("right-aligns multiple columns", () => {
    const input = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
    const output = setColumnsAlignment(input, [0, 2], "right");
    expect(extractSeparator(output)).toBe("| ---: | --- | ---: |");
  });

  it("applies mixed alignments to different columns", () => {
    const input = "| A | B | C | D |\n| --- | --- | --- | --- |\n| 1 | 2 | 3 | 4 |";
    const output = setMixedColumnsAlignment(input, {
      0: "left",
      1: "center",
      3: "right",
    });
    expect(extractSeparator(output)).toBe("| :--- | :---: | --- | ---: |");
  });

  it("preserves dash counts exactly when changing alignment", () => {
    const input = "| A | B | C |\n| :-- | ----------: | :---: |\n| 1 | 2 | 3 |";
    const output = setTableAlignment(input, "left");
    const separator = extractSeparator(output);
    expect(separator).toBe("| :-- | :---------- | :--- |");

    // Extract dash counts from the separator cells.
    const cells = separator.split("|").slice(1, -1).map((cell) => cell.trim());
    expect(cells[0]).toMatch(/^:--$/);
    expect(cells[1]).toMatch(/^:----------$/);
    expect(cells[2]).toMatch(/^:---$/);

    // Re-apply and verify idempotence plus unchanged dash counts.
    const output2 = setTableAlignment(output, "left");
    expect(extractSeparator(output2)).toBe(separator);
  });

  it("is idempotent when the same alignment is applied twice", () => {
    const input = "| A | B |\n| --- | ---: |\n| 1 | 2 |";
    const once = setTableAlignment(input, "center");
    const twice = setTableAlignment(once, "center");
    expect(twice).toBe(once);
  });

  it("is idempotent for column-specific alignment", () => {
    const input = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
    const once = setColumnsAlignment(input, [0, 2], "right");
    const twice = setColumnsAlignment(once, [0, 2], "right");
    expect(twice).toBe(once);
  });

  it("tolerates rows missing leading or trailing pipes", () => {
    const input = "A | B\n--- | ---:\n1 | 2";
    const output = setTableAlignment(input, "center");
    expect(output.split("\n")[1]).toBe(":---: | :---:");
  });

  it("tolerates cells with extra whitespace", () => {
    const input = "|  A  |  B  |\n| --- | :--- |\n| 1   | 2   |";
    const output = setColumnAlignment(input, 1, "right");
    expect(extractSeparator(output)).toBe("| --- | ---: |");
  });

  it("does not treat HTML tags or merge markers inside body cells as separators", () => {
    const input = [
      "| A | B |",
      "| --- | --- |",
      "| <font>1</font> | x^2 |",
      "| < | ^ |",
    ].join("\n");
    const output = setTableAlignment(input, "right");
    const lines = output.split("\n");
    expect(lines[1]).toBe("| ---: | ---: |");
    expect(lines[2]).toBe("| <font>1</font> | x^2 |");
    expect(lines[3]).toBe("| < | ^ |");
  });

  it("preserves merge-marker comments in body cells", () => {
    const input = [
      "| A | B | C |",
      "| --- | --- | --- |",
      "| 1 | <!-- sheet-extend:merge-left --> | <!-- sheet-extend:merge-left --> |",
    ].join("\n");
    const output = setColumnsAlignment(input, [0, 2], "center");
    const lines = output.split("\n");
    expect(lines[1]).toBe("| :---: | --- | :---: |");
    expect(lines[2]).toBe(
      "| 1 | <!-- sheet-extend:merge-left --> | <!-- sheet-extend:merge-left --> |"
    );
  });

  it("gracefully handles a mismatch between row count and separator columns", () => {
    const input = "| A | B | C |\n| --- | --- |\n| 1 | 2 | 3 |";
    const output = setTableAlignment(input, "center");
    expect(extractSeparator(output)).toBe("| :---: | :---: |");
  });

  it("gracefully handles a separator row with more columns than the header", () => {
    const input = "| A | B |\n| --- | --- | --- |\n| 1 | 2 |";
    const output = setTableAlignment(input, "right");
    expect(extractSeparator(output)).toBe("| ---: | ---: | ---: |");
  });

  it("preserves CRLF line endings", () => {
    const input = "| A | B |\r\n| --- | --- |\r\n| 1 | 2 |";
    const output = setTableAlignment(input, "left");
    expect(output).toBe("| A | B |\r\n| :--- | :--- |\r\n| 1 | 2 |");
  });

  it("returns the original text unchanged when there is no separator line", () => {
    const input = "| A | B |\n| 1 | 2 |";
    expect(setTableAlignment(input, "center")).toBe(input);
  });
});
