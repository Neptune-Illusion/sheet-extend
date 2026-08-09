export type TableAlignment = "default" | "left" | "right" | "center";

interface SeparatorColumn {
  align: TableAlignment;
  dashCount: number;
}

interface SeparatorLine {
  original: string;
  leadingPipe: boolean;
  trailingPipe: boolean;
  columns: SeparatorColumn[];
}

function getLineEnding(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function parseAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (left) return "left";
  if (right) return "right";
  return "default";
}

function parseDashCount(cell: string): number {
  const match = cell.trim().match(/^:?(-{1,}):?$/);
  return match ? match[1].length : 3;
}

function parseSeparatorLine(line: string): SeparatorLine | null {
  const trimmed = line.trim();
  const leadingPipe = trimmed.startsWith("|");
  const trailingPipe = trimmed.endsWith("|");
  let inner = trimmed;
  if (leadingPipe) inner = inner.slice(1);
  if (trailingPipe) inner = inner.slice(0, -1);

  const rawCells = inner.split("|").map((cell) => cell.trim());
  if (rawCells.length === 0 || rawCells.every((cell) => cell === "")) return null;

  const columns: SeparatorColumn[] = [];
  for (const cell of rawCells) {
    if (cell === "") {
      // Tolerate empty cells as default alignment with a minimal dash count.
      columns.push({ align: "default", dashCount: 3 });
      continue;
    }
    const match = cell.match(/^(:)?(-{1,})(:)?$/);
    if (!match) return null;
    columns.push({
      align: parseAlignment(cell),
      dashCount: match[2].length,
    });
  }

  return { original: line, leadingPipe, trailingPipe, columns };
}

function serializeAlignment(align: TableAlignment, dashCount: number): string {
  const dashes = "-".repeat(dashCount);
  switch (align) {
    case "left":
      return `:${dashes}`;
    case "right":
      return `${dashes}:`;
    case "center":
      return `:${dashes}:`;
    default:
      return dashes;
  }
}

function serializeSeparatorLine(separator: SeparatorLine): string {
  const cells = separator.columns.map((column) =>
    serializeAlignment(column.align, column.dashCount)
  );
  const body = ` ${cells.join(" | ")} `;
  if (separator.leadingPipe && separator.trailingPipe) return `|${body}|`;
  if (separator.leadingPipe) return `|${body}`;
  if (separator.trailingPipe) return `${body}|`;
  return body.trim();
}

function findSeparatorLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const separator = parseSeparatorLine(lines[i]);
    if (separator) return i;
  }
  return -1;
}

function applyAlignment(
  separator: SeparatorLine,
  columnIndices: number[],
  alignment: TableAlignment
): SeparatorLine {
  if (columnIndices.length === 0) return separator;

  const indices = new Set(columnIndices);
  return {
    ...separator,
    columns: separator.columns.map((column, index) =>
      indices.has(index) ? { ...column, align: alignment } : column
    ),
  };
}

/**
 * Apply alignment to all columns in a markdown table.
 */
export function setTableAlignment(
  markdown: string,
  alignment: TableAlignment
): string {
  const lines = splitLines(markdown);
  const lineEnding = getLineEnding(markdown);
  const separatorIndex = findSeparatorLine(lines);
  if (separatorIndex < 0) return markdown;

  const separator = parseSeparatorLine(lines[separatorIndex])!;
  const allColumns = separator.columns.map((_, index) => index);
  lines[separatorIndex] = serializeSeparatorLine(
    applyAlignment(separator, allColumns, alignment)
  );
  return lines.join(lineEnding);
}

/**
 * Apply alignment to a set of columns in a markdown table.
 */
export function setColumnsAlignment(
  markdown: string,
  columnIndices: number[],
  alignment: TableAlignment
): string {
  const lines = splitLines(markdown);
  const lineEnding = getLineEnding(markdown);
  const separatorIndex = findSeparatorLine(lines);
  if (separatorIndex < 0) return markdown;

  const separator = parseSeparatorLine(lines[separatorIndex])!;
  lines[separatorIndex] = serializeSeparatorLine(
    applyAlignment(separator, columnIndices, alignment)
  );
  return lines.join(lineEnding);
}

/**
 * Apply alignment to a single column in a markdown table.
 */
export function setColumnAlignment(
  markdown: string,
  columnIndex: number,
  alignment: TableAlignment
): string {
  return setColumnsAlignment(markdown, [columnIndex], alignment);
}

/**
 * Apply mixed alignments to a markdown table.
 * `alignments` maps column indices to alignment values.
 */
export function setMixedColumnsAlignment(
  markdown: string,
  alignments: Record<number, TableAlignment>
): string {
  const lines = splitLines(markdown);
  const lineEnding = getLineEnding(markdown);
  const separatorIndex = findSeparatorLine(lines);
  if (separatorIndex < 0) return markdown;

  const separator = parseSeparatorLine(lines[separatorIndex])!;
  const nextColumns = separator.columns.map((column, index) => {
    if (Object.prototype.hasOwnProperty.call(alignments, index)) {
      return { ...column, align: alignments[index] };
    }
    return column;
  });
  lines[separatorIndex] = serializeSeparatorLine({
    ...separator,
    columns: nextColumns,
  });
  return lines.join(lineEnding);
}
