import { isMergeMarkerCell } from "./detect";

export interface TableRange {
  startLine: number;
  endLine: number;
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface CellSelection {
  anchor: CellPosition;
  focus: CellPosition;
}

export type MergeDirection = "horizontal" | "vertical";

export interface MergeWritebackResult {
  text: string;
  range: TableRange;
}

interface ParsedLine {
  cells: string[];
  hasLeadingPipe: boolean;
  hasTrailingPipe: boolean;
}

function getLineEnding(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function normalizeSelection(selection: CellSelection): {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
} {
  return {
    rowStart: Math.min(selection.anchor.row, selection.focus.row),
    rowEnd: Math.max(selection.anchor.row, selection.focus.row),
    colStart: Math.min(selection.anchor.col, selection.focus.col),
    colEnd: Math.max(selection.anchor.col, selection.focus.col),
  };
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

function isDelimiterCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function parseLine(line: string): ParsedLine {
  const trimmed = line.trim();
  const hasLeadingPipe = trimmed.startsWith("|");
  const hasTrailingPipe = trimmed.endsWith("|");
  let inner = hasLeadingPipe ? trimmed.slice(1) : trimmed;
  if (hasTrailingPipe) inner = inner.slice(0, -1);
  return {
    cells: inner.split("|").map((cell) => cell.trim()),
    hasLeadingPipe,
    hasTrailingPipe,
  };
}

function serializeLine(parsed: ParsedLine): string {
  const body = ` ${parsed.cells.join(" | ")} `;
  if (parsed.hasLeadingPipe && parsed.hasTrailingPipe) return `|${body}|`;
  if (parsed.hasLeadingPipe) return `|${body}`;
  if (parsed.hasTrailingPipe) return `${body}|`;
  return body.trim();
}

export function findTableRangeAtLine(text: string, lineNumber: number): TableRange | null {
  const lines = splitLines(text);
  if (lineNumber < 0 || lineNumber >= lines.length || !isTableLine(lines[lineNumber])) {
    return null;
  }

  let startLine = lineNumber;
  while (startLine > 0 && isTableLine(lines[startLine - 1])) {
    startLine--;
  }

  let endLine = lineNumber;
  while (endLine < lines.length - 1 && isTableLine(lines[endLine + 1])) {
    endLine++;
  }

  return { startLine, endLine };
}

function parseTableLines(lines: string[]): { parsed: ParsedLine[]; delimiterIndex: number } {
  const parsed = lines.map(parseLine);
  const delimiterIndex = parsed.findIndex((line, index) => (
    index > 0 && line.cells.length > 0 && line.cells.every(isDelimiterCell)
  ));
  return { parsed, delimiterIndex };
}

function markdownLineForGridRow(gridRow: number, delimiterIndex: number): number {
  if (delimiterIndex < 0) return gridRow;
  return gridRow < delimiterIndex ? gridRow : gridRow + 1;
}

function ensureColumn(line: ParsedLine, col: number): void {
  while (line.cells.length <= col) {
    line.cells.push("");
  }
}

function isMergeMarker(value: string | undefined): boolean {
  return isMergeMarkerCell(value);
}

const HIDDEN_MERGE_LEFT = "<!-- sheet-extend:merge-left -->";
const HIDDEN_MERGE_UP = "<!-- sheet-extend:merge-up -->";

export function applyMergeMarkers(
  tableText: string,
  selection: CellSelection,
  direction: MergeDirection
): string {
  const lines = splitLines(tableText);
  const lineEnding = getLineEnding(tableText);
  const { parsed, delimiterIndex } = parseTableLines(lines);
  const normalized = normalizeSelection(selection);

  if (normalized.rowStart === normalized.rowEnd && normalized.colStart === normalized.colEnd) {
    return tableText;
  }

  for (let row = normalized.rowStart; row <= normalized.rowEnd; row++) {
    const lineIndex = markdownLineForGridRow(row, delimiterIndex);
    const line = parsed[lineIndex];
    if (!line) continue;

    if (
      row === normalized.rowStart &&
      isMergeMarker(line.cells[normalized.colStart])
    ) {
      return tableText;
    }

    const selectedColStart = normalized.colStart;
    const selectedColEnd = normalized.colEnd;
    for (let col = selectedColStart; col <= selectedColEnd; col++) {
      ensureColumn(line, col);
      const isAnchor = row === normalized.rowStart && col === normalized.colStart;
      if (isAnchor) continue;

      if (direction === "horizontal" && row === normalized.rowStart) {
        line.cells[col] = HIDDEN_MERGE_LEFT;
      } else if (direction === "vertical" && col === normalized.colStart) {
        line.cells[col] = HIDDEN_MERGE_UP;
      }
    }
  }

  return parsed.map(serializeLine).join(lineEnding);
}

export function clearMergeMarkers(tableText: string, selection: CellSelection): string {
  const lines = splitLines(tableText);
  const lineEnding = getLineEnding(tableText);
  const { parsed, delimiterIndex } = parseTableLines(lines);
  const normalized = normalizeSelection(selection);

  for (let row = normalized.rowStart; row <= normalized.rowEnd; row++) {
    const lineIndex = markdownLineForGridRow(row, delimiterIndex);
    const line = parsed[lineIndex];
    if (!line) continue;

    for (let col = normalized.colStart; col <= normalized.colEnd; col++) {
      if (isMergeMarker(line.cells[col])) {
        line.cells[col] = "";
      }
    }
  }

  return parsed.map(serializeLine).join(lineEnding);
}

export function replaceTableRange(
  documentText: string,
  range: TableRange,
  tableText: string
): string {
  const lines = splitLines(documentText);
  const lineEnding = getLineEnding(documentText);
  lines.splice(range.startLine, range.endLine - range.startLine + 1, ...splitLines(tableText));
  return lines.join(lineEnding);
}

export function applyMergeToDocument(
  documentText: string,
  range: TableRange,
  selection: CellSelection,
  direction: MergeDirection
): MergeWritebackResult {
  const lineEnding = getLineEnding(documentText);
  const tableText = splitLines(documentText).slice(range.startLine, range.endLine + 1).join(lineEnding);
  const nextTableText = applyMergeMarkers(tableText, selection, direction);
  return {
    text: replaceTableRange(documentText, range, nextTableText),
    range,
  };
}

export function clearMergeInDocument(
  documentText: string,
  range: TableRange,
  selection: CellSelection
): MergeWritebackResult {
  const lineEnding = getLineEnding(documentText);
  const tableText = splitLines(documentText).slice(range.startLine, range.endLine + 1).join(lineEnding);
  const nextTableText = clearMergeMarkers(tableText, selection);
  return {
    text: replaceTableRange(documentText, range, nextTableText),
    range,
  };
}
