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
    .split("\n")
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
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.hidden) continue;

      if (cell.text === "<" && c > 0) {
        for (let pc = c - 1; pc >= 0; pc--) {
          const prev = grid[r][pc];
          if (!prev.hidden) {
            prev.colspan = (prev.colspan || 1) + 1;
            cell.hidden = true;
            break;
          }
        }
      } else if (cell.text === "^" && r > 0) {
        for (let pr = r - 1; pr >= 0; pr--) {
          const prev = grid[pr][c];
          if (!prev.hidden) {
            prev.rowspan = (prev.rowspan || 1) + 1;
            cell.hidden = true;
            break;
          }
        }
      }
    }
  }
}

export function stripMergeMarkers(grid: Cell[][]): void {
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.hidden) {
        cell.text = cell.text.replace(/[<^]/g, "").trim();
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
