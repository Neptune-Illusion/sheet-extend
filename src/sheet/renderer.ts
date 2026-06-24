import { MarkdownRenderer, App, Component } from "obsidian";
import type { ParsedTable } from "./parser";

/**
 * Check if any header cell has a rowspan that extends into data rows.
 * HTML does not allow rowspan to cross thead/tbody boundaries, so when
 * this happens we must render all rows in a single tbody.
 */
function hasRowspanAcrossBoundary(grid: import("./parser").Cell[][], headerCount: number): boolean {
  for (let r = 0; r < headerCount; r++) {
    for (const cell of grid[r]) {
      if (!cell.hidden && cell.rowspan > 1 && r + cell.rowspan > headerCount) {
        return true;
      }
    }
  }
  return false;
}

export function renderTable(
  app: App,
  tableEl: HTMLTableElement,
  parsed: ParsedTable,
  sourcePath: string,
  component: Component
): void {
  const { grid, alignments } = parsed;

  tableEl.empty();
  tableEl.id = "sheet-extend-parsed";
  tableEl.removeAttribute("data-resizable");

  if (grid.length === 0) return;

  const colCount = Math.max(...grid.map((row) => row.length));
  const colgroup = tableEl.createEl("colgroup");
  for (let i = 0; i < colCount; i++) {
    const col = colgroup.createEl("col");
    if (alignments[i]) {
      col.setAttribute("data-align", alignments[i]);
    }
  }

  const headerCount = 1;
  const crossBoundary = hasRowspanAcrossBoundary(grid, headerCount);

  if (crossBoundary) {
    // When rowspan crosses header/data boundary, render all rows in a single
    // tbody to avoid the HTML limitation where rowspan cannot span across
    // thead and tbody sections.
    const tbody = tableEl.createEl("tbody");
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      const tr = tbody.createEl("tr");
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (cell.hidden) continue;
        const tag = cell.isHeader ? "th" : "td";
        const el = tr.createEl(tag);
        if (alignments[c]) {
          el.style.textAlign = alignments[c] === "default" ? "left" : alignments[c];
        }
        if (cell.colspan > 1) el.colSpan = cell.colspan;
        if (cell.rowspan > 1) el.rowSpan = cell.rowspan;
        el.setAttribute("data-row", String(r));
        el.setAttribute("data-col", String(c));
        MarkdownRenderer.render(app, cell.text, el, sourcePath, component);
      }
    }
  } else {
    // Normal case: separate thead and tbody
    const headerRows = grid.slice(0, headerCount);
    const dataRows = grid.slice(headerCount);

    if (headerRows.length > 0) {
      const thead = tableEl.createEl("thead");
      for (const row of headerRows) {
        const tr = thead.createEl("tr");
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (cell.hidden) continue;
          const th = tr.createEl("th");
          if (alignments[c]) {
            th.style.textAlign = alignments[c] === "default" ? "left" : alignments[c];
          }
          if (cell.colspan > 1) th.colSpan = cell.colspan;
          if (cell.rowspan > 1) th.rowSpan = cell.rowspan;
          th.setAttribute("data-row", "0");
          th.setAttribute("data-col", String(c));
          MarkdownRenderer.render(app, cell.text, th, sourcePath, component);
        }
      }
    }

    if (dataRows.length > 0) {
      const tbody = tableEl.createEl("tbody");
      for (let r = 0; r < dataRows.length; r++) {
        const tr = tbody.createEl("tr");
        for (let c = 0; c < dataRows[r].length; c++) {
          const cell = dataRows[r][c];
          if (cell.hidden) continue;
          const tag = cell.isHeader ? "th" : "td";
          const td = tr.createEl(tag);
          if (alignments[c]) {
            td.style.textAlign = alignments[c] === "default" ? "left" : alignments[c];
          }
          if (cell.colspan > 1) td.colSpan = cell.colspan;
          if (cell.rowspan > 1) td.rowSpan = cell.rowspan;
          td.setAttribute("data-row", String(r + 1));
          td.setAttribute("data-col", String(c));
          MarkdownRenderer.render(app, cell.text, td, sourcePath, component);
        }
      }
    }
  }
}
