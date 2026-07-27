import type { ParsedTable } from "./parser";

function addCellCoordinates(tableEl: HTMLTableElement): void {
  const occupied = new Map<string, true>();
  for (let rowIndex = 0; rowIndex < tableEl.rows.length; rowIndex++) {
    const row = tableEl.rows[rowIndex];
    let logicalCol = 0;
    for (const cell of Array.from(row.cells)) {
      while (occupied.has(`${rowIndex}:${logicalCol}`)) logicalCol++;
      cell.setAttribute("data-row", String(rowIndex));
      cell.setAttribute("data-col", String(logicalCol));
      for (let r = 0; r < (cell.rowSpan || 1); r++) {
        for (let c = 0; c < (cell.colSpan || 1); c++) {
          occupied.set(`${rowIndex + r}:${logicalCol + c}`, true);
        }
      }
      logicalCol += cell.colSpan || 1;
    }
  }
}

function flattenSections(tableEl: HTMLTableElement): void {
  const thead = tableEl.tHead;
  if (!thead || !tableEl.tBodies.length) return;
  const tbody = tableEl.tBodies[0];
  tbody.prepend(...Array.from(thead.rows));
  thead.remove();
}

function ensureLogicalColumns(tableEl: HTMLTableElement, parsed: ParsedTable): void {
  for (let rowIndex = 0; rowIndex < tableEl.rows.length; rowIndex++) {
    const row = tableEl.rows[rowIndex];
    const target = parsed.grid[rowIndex]?.length || 0;
    const current = Array.from(row.cells).reduce((sum, cell) => sum + (cell.colSpan || 1), 0);
    const tag = row.parentElement?.tagName === "THEAD" ? "th" : "td";
    for (let col = current; col < target; col++) row.appendChild(tableEl.ownerDocument.createElement(tag));
  }
}

/**
 * Apply Sheet Extend merge geometry to an Obsidian-native Live Preview table.
 * Returns true when the table had to be flattened across thead/tbody.
 */
export function applyLivePreviewMerge(tableEl: HTMLTableElement, parsed: ParsedTable): boolean {
  const headerRows = tableEl.tHead?.rows.length || 0;
  const crossesSections = !!tableEl.tHead && tableEl.tBodies.length > 0 && parsed.grid
    .slice(0, headerRows || 1)
    .some((row, index) => row.some((cell) => !cell.hidden && cell.rowspan > 1 && index + cell.rowspan > headerRows));

  if (crossesSections) flattenSections(tableEl);

  for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
    cell.style.display = "";
    cell.colSpan = 1;
    cell.rowSpan = 1;
  }
  ensureLogicalColumns(tableEl, parsed);
  addCellCoordinates(tableEl);

  const cells = new Map<string, HTMLTableCellElement>();
  for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
    cells.set(`${cell.getAttribute("data-row")}:${cell.getAttribute("data-col")}`, cell);
  }

  for (let row = 0; row < parsed.grid.length; row++) {
    for (let col = 0; col < parsed.grid[row].length; col++) {
      const parsedCell = parsed.grid[row][col];
      const domCell = cells.get(`${row}:${col}`);
      if (!domCell) continue;
      if (parsedCell.hidden) {
        domCell.style.display = "none";
        domCell.textContent = "";
      } else {
        domCell.colSpan = parsedCell.colspan || 1;
        domCell.rowSpan = parsedCell.rowspan || 1;
      }
    }
  }

  return crossesSections;
}
