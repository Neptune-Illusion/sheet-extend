import { isMergeLeftMarker, isMergeMarkerCell, isMergeUpMarker } from "./detect";

export interface Cell {
  text: string;
  colspan: number;
  rowspan: number;
  hidden: boolean;
  isHeader: boolean;
}

export interface ParsedTable {
  grid: Cell[][];
  alignments: string[];
}

export function parseTable(text: string): ParsedTable {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { grid: [], alignments: [] };
  }

  const rawRows: string[][] = lines.map((line) => {
    const inner = line.startsWith("|") ? line.slice(1) : line;
    const trimmed = inner.endsWith("|") ? inner.slice(0, -1) : inner;
    return trimmed.split("|").map((c) => c.trim());
  });

  let delimIdx = -1;
  for (let i = 1; i < rawRows.length; i++) {
    if (rawRows[i].every((c) => /^:?-{3,}:?$/.test(c))) {
      delimIdx = i;
      break;
    }
  }

  const alignments: string[] = [];
  if (delimIdx >= 0) {
    for (const cell of rawRows[delimIdx]) {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) alignments.push("center");
      else if (right) alignments.push("right");
      else if (left) alignments.push("left");
      else alignments.push("default");
    }
  }

  const dataRows = delimIdx >= 0 ? rawRows.slice(delimIdx + 1) : rawRows.slice(1);
  const headerRows = delimIdx > 0 ? rawRows.slice(0, delimIdx) : [rawRows[0]];

  const colCount = Math.max(...dataRows.map((r) => r.length), ...headerRows.map((r) => r.length));
  const verticalHeaderCols: boolean[] = Array(colCount).fill(true);
  for (const row of dataRows) {
    for (let c = 0; c < colCount; c++) {
      const cell = (c < row.length ? row[c] : "").replace(/[`*_~]/g, "");
      if (cell !== "" && !/^:?-{3,}:?$/.test(cell)) {
        verticalHeaderCols[c] = false;
      }
    }
  }

  const grid: Cell[][] = [];

  for (const row of headerRows) {
    const gridRow: Cell[] = [];
    for (let c = 0; c < colCount; c++) {
      const text = c < row.length ? row[c] : "";
      const cell: Cell = { text, colspan: 1, rowspan: 1, hidden: false, isHeader: true };
      gridRow.push(cell);
    }
    grid.push(gridRow);
  }

  for (const row of dataRows) {
    const gridRow: Cell[] = [];
    for (let c = 0; c < colCount; c++) {
      const text = c < row.length ? row[c] : "";
      const isHeader = verticalHeaderCols[c] || false;
      const cell: Cell = { text, colspan: 1, rowspan: 1, hidden: false, isHeader };
      gridRow.push(cell);
    }
    grid.push(gridRow);
  }

  return { grid, alignments };
}

export function applyMerges(grid: Cell[][]): void {
  for (let r = 0; r < grid.length; r++) {
    const extendedVertically = new Set<Cell>();
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.hidden) continue;

      if (isMergeLeftMarker(cell.text) && c > 0) {
        const anchor = findAnchor(grid, r, c - 1, "horizontal");
        if (anchor && canExpand(grid, anchor, r, c, "horizontal")) {
          anchor.cell.colspan = Math.max(anchor.cell.colspan || 1, c - anchor.col + 1);
          hideCoveredCells(grid, anchor, r, c, "horizontal");
          cell.hidden = true;
        }
      } else if (isMergeUpMarker(cell.text) && r > 0) {
        // A vertical marker can sit under a horizontally merged cell.
        // Find the visible cell whose colspan covers this logical column,
        // rather than only checking grid[previousRow][c].
        const anchor = findAnchor(grid, r, c, "vertical");
        if (anchor && canExpand(grid, anchor, r, c, "vertical")) {
          if (!extendedVertically.has(anchor.cell)) {
            anchor.cell.rowspan = (anchor.cell.rowspan || 1) + 1;
            extendedVertically.add(anchor.cell);
          }
          hideCoveredCells(grid, anchor, r, c, "vertical");
          cell.hidden = true;
        }
      }
    }
  }
}

function findAnchor(
  grid: Cell[][],
  row: number,
  col: number,
  direction: "horizontal" | "vertical"
): { cell: Cell; row: number; col: number } | null {
  for (let r = row; r >= 0; r--) {
    for (let c = 0; c < grid[r].length; c++) {
      const candidate = grid[r][c];
      if (candidate.hidden) continue;
      const coversRow = direction === "vertical"
        ? r < row && r + (candidate.rowspan || 1) >= row
        : r <= row && row < r + (candidate.rowspan || 1);
      const coversCol = c <= col && col < c + (candidate.colspan || 1);
      if (!coversRow || !coversCol) continue;
      if (direction === "vertical" && r === row) continue;
      return { cell: candidate, row: r, col: c };
    }
  }
  return null;
}

function canExpand(
  grid: Cell[][],
  anchor: { cell: Cell; row: number; col: number },
  targetRow: number,
  targetCol: number,
  direction: "horizontal" | "vertical"
): boolean {
  const rowEnd = direction === "vertical" ? targetRow : anchor.row + (anchor.cell.rowspan || 1) - 1;
  const colEnd = direction === "horizontal" ? targetCol : anchor.col + (anchor.cell.colspan || 1) - 1;

  for (let row = anchor.row; row <= rowEnd; row++) {
    for (let col = anchor.col; col <= colEnd; col++) {
      if (row === anchor.row && col === anchor.col) continue;
      const occupant = grid[row]?.[col];
      if (
        !occupant ||
        occupant.hidden ||
        isMergeMarkerCell(occupant.text) ||
        occupant.text.trim() === ""
      ) continue;
      if (row < anchor.row + (anchor.cell.rowspan || 1) && col < anchor.col + (anchor.cell.colspan || 1)) continue;
      return false;
    }
  }
  return true;
}

function hideCoveredCells(
  grid: Cell[][],
  anchor: { cell: Cell; row: number; col: number },
  targetRow: number,
  targetCol: number,
  direction: "horizontal" | "vertical"
): void {
  const rowEnd = direction === "vertical" ? targetRow : anchor.row + (anchor.cell.rowspan || 1) - 1;
  const colEnd = direction === "horizontal" ? targetCol : anchor.col + (anchor.cell.colspan || 1) - 1;
  for (let row = anchor.row; row <= rowEnd; row++) {
    for (let col = anchor.col; col <= colEnd; col++) {
      const occupant = grid[row]?.[col];
      if (!occupant || occupant === anchor.cell) continue;
      if (occupant.text.trim() === "" || isMergeMarkerCell(occupant.text)) occupant.hidden = true;
    }
  }
}

export function stripMergeMarkers(grid: Cell[][]): void {
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.hidden) {
        // Only strip merge markers when the entire cell content is exactly
        // "<" or "^". Do NOT strip < or ^ from cells containing HTML tags
        // or other content.
        const trimmed = cell.text.trim();
        if (isMergeMarkerCell(trimmed)) {
          cell.text = "";
        }
      }
    }
  }
}

export function parseAndMerge(text: string): ParsedTable {
  const result = parseTable(text);
  applyMerges(result.grid);
  stripMergeMarkers(result.grid);
  return result;
}
