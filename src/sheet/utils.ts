import type { CellSelection, TableRange } from "./writeback";

// Shared table utilities used across merge/interaction, main.ts, and writeback.
// ponytail: single copy, no duplication.

export function getLineEnding(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export const isTableLine = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
};

export function normalizeSelection(selection: CellSelection): {
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

export function selectionHasHorizontalSpan(selection: CellSelection): boolean {
  const bounds = normalizeSelection(selection);
  return bounds.colEnd > bounds.colStart;
}

export function selectionHasVerticalSpan(selection: CellSelection): boolean {
  const bounds = normalizeSelection(selection);
  return bounds.rowEnd > bounds.rowStart;
}

export function getTableBounds(tableEl: HTMLTableElement): { maxRow: number; maxCol: number } {
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
    const row = Number(cell.getAttribute("data-row"));
    const col = Number(cell.getAttribute("data-col"));
    if (Number.isInteger(row)) maxRow = Math.max(maxRow, row);
    if (Number.isInteger(col)) maxCol = Math.max(maxCol, col + (cell.colSpan || 1) - 1);
  }
  return { maxRow, maxCol };
}

export function expandSelectionForDirection(
  tableEl: HTMLTableElement,
  selection: CellSelection,
  direction: "horizontal" | "vertical"
): CellSelection | null {
  if (direction === "horizontal" && selectionHasHorizontalSpan(selection)) return selection;
  if (direction === "vertical" && selectionHasVerticalSpan(selection)) return selection;

  const { maxRow, maxCol } = getTableBounds(tableEl);
  if (direction === "horizontal" && selection.focus.col < maxCol) {
    return { anchor: selection.anchor, focus: { row: selection.focus.row, col: selection.focus.col + 1 } };
  }
  if (direction === "vertical" && selection.focus.row < maxRow) {
    return { anchor: selection.anchor, focus: { row: selection.focus.row + 1, col: selection.focus.col } };
  }
  return null;
}

export function expandSelectionForUnmerge(tableEl: HTMLTableElement, selection: CellSelection): CellSelection {
  const bounds = {
    rowStart: Math.min(selection.anchor.row, selection.focus.row),
    rowEnd: Math.max(selection.anchor.row, selection.focus.row),
    colStart: Math.min(selection.anchor.col, selection.focus.col),
    colEnd: Math.max(selection.anchor.col, selection.focus.col),
  };

  for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
    const row = Number(cell.getAttribute("data-row"));
    const col = Number(cell.getAttribute("data-col"));
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;

    const rowEnd = row + (cell.rowSpan || 1) - 1;
    const colEnd = col + (cell.colSpan || 1) - 1;
    if (!(row <= bounds.rowEnd && rowEnd >= bounds.rowStart && col <= bounds.colEnd && colEnd >= bounds.colStart)) continue;

    bounds.rowStart = Math.min(bounds.rowStart, row);
    bounds.rowEnd = Math.max(bounds.rowEnd, rowEnd);
    bounds.colStart = Math.min(bounds.colStart, col);
    bounds.colEnd = Math.max(bounds.colEnd, colEnd);
  }

  return {
    anchor: { row: bounds.rowStart, col: bounds.colStart },
    focus: { row: bounds.rowEnd, col: bounds.colEnd },
  };
}
