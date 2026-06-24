import { Plugin, MarkdownView, MarkdownRenderChild } from "obsidian";
import { SheetExtendSettings, DEFAULT_SETTINGS, SheetExtendSettingTab } from "./src/settings";
import { parseAndMerge } from "./src/sheet/parser";
import { renderTable } from "./src/sheet/renderer";
import { hasMergeMarkers, hasMergeMarkersInElement } from "./src/sheet/detect";
import { applyFormulas } from "./src/sheet/formulas";
import {
  buildSeparatorLineForWidths,
  extractMarkdownTableSpecs,
  matchMarkdownTableSpecForElement,
  splitMarkdownLines,
} from "./src/sheet/markdown-table";
import { makeTableResizable } from "./src/resizer/resizer";
import { getTableIds, saveWidths, loadWidths, applySavedWidths } from "./src/resizer/persistence";
import { installMergeInteraction, runMergeCommand, runUnmergeCommand } from "./src/merge/interaction";
import type { CellSelection, TableRange } from "./src/sheet/writeback";

interface TableMatch {
  text: string;
  range: TableRange;
  sourcePath: string;
  tableOrdinal?: number;
}

interface TableEnhancementContext {
  sourcePath: string;
  getSectionInfo?: (el: HTMLElement) => { text: string; lineStart: number; lineEnd: number } | null;
}

type EditorLike = MarkdownView["editor"] & {
  posAtDOM?: (node: Node, offset: number) => { line: number; ch: number };
};

/**
 * Ensure a table has a <colgroup> with one <col> per column.
 * Native Obsidian-rendered tables (plain tables without ^/< merge markers) have
 * no colgroup, but the resizer and applySavedWidths both operate on colgroup>col.
 * Injecting one lets plain tables reuse the existing resize/persistence path.
 * Idempotent: does nothing if a colgroup already exists (post processor may fire
 * multiple times on the same table).
 */
function ensureColgroup(tableEl: HTMLTableElement): void {
  if (tableEl.querySelector("colgroup")) return;

  const colCount = getLogicalColumnCount(tableEl);
  if (colCount === 0) return;

  const colgroup = document.createElement("colgroup");
  for (let i = 0; i < colCount; i++) {
    colgroup.appendChild(document.createElement("col"));
  }
  // colgroup must precede thead/tbody in the table.
  tableEl.insertBefore(colgroup, tableEl.firstChild);
}

function getLogicalColumnCount(tableEl: HTMLTableElement): number {
  let colCount = 0;
  for (const row of Array.from(tableEl.rows)) {
    let width = 0;
    for (const cell of Array.from(row.cells)) {
      width += cell.colSpan || 1;
    }
    colCount = Math.max(colCount, width);
  }
  return colCount;
}

function isSourceModeTable(tableEl: HTMLTableElement): boolean {
  return !!tableEl.closest(".markdown-source-view, .cm-table-widget");
}

function selectionHasHorizontalSpan(selection: CellSelection): boolean {
  return Math.abs(selection.anchor.col - selection.focus.col) > 0;
}

function selectionHasVerticalSpan(selection: CellSelection): boolean {
  return Math.abs(selection.anchor.row - selection.focus.row) > 0;
}

function getTableBounds(tableEl: HTMLTableElement): { maxRow: number; maxCol: number } {
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLElement[]) {
    const row = Number(cell.getAttribute("data-row"));
    const col = Number(cell.getAttribute("data-col"));
    if (Number.isInteger(row)) maxRow = Math.max(maxRow, row);
    if (Number.isInteger(col)) maxCol = Math.max(maxCol, col + ((cell as HTMLTableCellElement).colSpan || 1) - 1);
  }
  return { maxRow, maxCol };
}

function expandSelectionForDirection(
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

function expandSelectionForUnmerge(tableEl: HTMLTableElement, selection: CellSelection): CellSelection {
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
    const intersects = (
      row <= bounds.rowEnd &&
      rowEnd >= bounds.rowStart &&
      col <= bounds.colEnd &&
      colEnd >= bounds.colStart
    );
    if (!intersects) continue;

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

class SheetExtendRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private app: import("obsidian").App,
    private sourcePath: string,
    private content: string,
    private enableFormulas: boolean
  ) {
    super(containerEl);
  }

  onload() {
    const tableEl = this.containerEl.createEl("table");
    const parsed = this.enableFormulas
      ? applyFormulas(parseAndMerge(this.content))
      : parseAndMerge(this.content);
    renderTable(this.app, tableEl, parsed, this.sourcePath, this);
  }
}

export default class SheetExtendPlugin extends Plugin {
  settings: SheetExtendSettings;
  widthStore: { [tableId: string]: (number | null)[] } = {};
  private tableRanges = new WeakMap<HTMLTableElement, TableRange>();
  private activeMergeSelection: { tableEl: HTMLTableElement; selection: CellSelection } | null = null;
  private refreshTimer: number | null = null;
  private observer: MutationObserver | null = null;
  private resizingTables = new WeakSet<HTMLTableElement>();

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SheetExtendSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((element, context) => {
      if (!this.settings.nativeProcessing) return;
      if (!this.app.workspace.getActiveViewOfType(MarkdownView)) return;

      const tables = Array.from(element.querySelectorAll("table:not([id='sheet-extend-parsed'])"));
      for (const tableEl of tables) {
        this.processTable(tableEl as HTMLTableElement, context);
      }
    });

    this.registerMarkdownCodeBlockProcessor("sheet", (source, el, ctx) => {
      const parsed = this.settings.enableFormulas
        ? applyFormulas(parseAndMerge(source))
        : parseAndMerge(source);
      const tableEl = el.createEl("table");
      renderTable(this.app, tableEl, parsed, ctx.sourcePath, this);
      this.setupResizer(tableEl);
      installMergeInteraction({
        app: this.app,
        component: this,
        getTableRange: (table) => this.tableRanges.get(table) || null,
        setActiveSelection: (context) => {
          this.activeMergeSelection = context;
        },
        onDocumentChanged: () => this.scheduleLivePreviewRefresh(0),
      }, tableEl);
    });

    this.addCommand({
      id: "merge-table-cells-horizontal",
      name: "Merge selected table cells horizontally",
      checkCallback: (checking) => this.runActiveMergeCommand(checking, "horizontal"),
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "ArrowRight" }],
    });

    this.addCommand({
      id: "merge-table-cells-vertical",
      name: "Merge selected table cells vertically",
      checkCallback: (checking) => this.runActiveMergeCommand(checking, "vertical"),
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "ArrowDown" }],
    });

    this.addCommand({
      id: "unmerge-table-cells",
      name: "Unmerge selected table cells",
      checkCallback: (checking) => this.runActiveUnmergeCommand(checking),
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "ArrowLeft" }],
    });

    this.registerEvent(this.app.workspace.on("editor-menu", (menu: any) => {
      this.addMergeItemsToEditorMenu(menu);
    }));

    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleLivePreviewRefresh()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleLivePreviewRefresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.scheduleLivePreviewRefresh()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.scheduleLivePreviewRefresh()));
    this.registerDomEvent(window, "resize", () => this.scheduleLivePreviewRefresh());
    this.observeWorkspaceTables();
    this.scheduleLivePreviewRefresh();
  }

  /**
   * Extract the raw markdown source for a table from the editor document.
   * In Live Preview mode, getSectionInfo often returns null and the DOM
   * may have already processed special characters like ^ (footnote marker).
   * This method reads directly from the CM6 editor to get untouched source.
   */
  private getSourceFromEditor(): string | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return null;
    // Access the editor's full document value
    const editor = view.editor;
    if (!editor) return null;
    return editor.getValue();
  }

  /**
   * Given the full document text, find the table block that contains
   * the approximate content matching the DOM table.
   * Returns the raw markdown table text or null if not found.
   */
  private findMergeTableInDocument(
    docText: string,
    tableEl: HTMLTableElement,
    sourcePath: string
  ): TableMatch | null {
    const hasSourceHint =
      tableEl.hasAttribute("data-line-start") ||
      Number.isInteger(this.getSourceLineForTable(tableEl));
    if (!hasMergeMarkersInElement(tableEl) && !hasSourceHint) {
      return null;
    }

    const lines = splitMarkdownLines(docText);
    const tableBlocks: { start: number; end: number }[] = [];

    let inTable = false;
    let blockStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const isTableLine = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;

      if (isTableLine && !inTable) {
        inTable = true;
        blockStart = i;
      } else if (!isTableLine && inTable) {
        inTable = false;
        tableBlocks.push({ start: blockStart, end: i - 1 });
      }
    }
    if (inTable) {
      tableBlocks.push({ start: blockStart, end: lines.length - 1 });
    }

    if (tableBlocks.length === 0) return null;

    // Try to match by checking which table block contains merge markers
    // and has a similar column count to the DOM table
    const domColCount = tableEl.querySelector("tr")?.children.length || 0;

    for (const block of tableBlocks) {
      const blockText = lines.slice(block.start, block.end + 1).join("\n");
      if (hasMergeMarkers(blockText)) {
        // Verify column count roughly matches
        const firstLine = lines[block.start];
        const colCount = (firstLine.match(/\|/g) || []).length - 1;
        if (domColCount === 0 || Math.abs(colCount - domColCount) <= 1) {
          return {
            text: blockText,
            range: { startLine: block.start, endLine: block.end },
            sourcePath,
          };
        }
      }
    }

    // If no merge-marker table found, return null (no special processing needed)
    return null;
  }

  private getSourceLineForTable(tableEl: HTMLTableElement): number | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.editor as EditorLike | undefined;
    if (!editor?.posAtDOM) return null;

    const candidates = [
      tableEl.closest(".cm-table-widget"),
      tableEl.querySelector("thead th"),
      tableEl.querySelector("tr th"),
      tableEl.querySelector("tr td"),
      tableEl,
    ].filter(Boolean) as Node[];

    for (const candidate of candidates) {
      for (const offset of [-1, 0, 1]) {
        try {
          const position = editor.posAtDOM(candidate, offset);
          if (position && Number.isInteger(position.line) && position.line >= 0) {
            return position.line;
          }
        } catch (_error) {}
      }
    }

    return null;
  }

  private applyTableMatchMetadata(
    tableEl: HTMLTableElement,
    match: Pick<TableMatch, "range" | "sourcePath"> & { tableOrdinal?: number }
  ): void {
    tableEl.setAttribute("data-source-path", match.sourcePath);
    tableEl.setAttribute("data-line-start", String(match.range.startLine));
    if (Number.isInteger(match.tableOrdinal)) {
      tableEl.dataset.sheetExtendTableOrdinal = String(match.tableOrdinal);
    }
  }

  private processTable(tableEl: HTMLTableElement, context: TableEnhancementContext) {
    if (!tableEl.isConnected) return;

    const match = this.resolveTableSource(tableEl, context);

    if (!match || !hasMergeMarkers(match.text)) {
      this.enhancePlainTable(tableEl, context, match);
      return;
    }

    if (isSourceModeTable(tableEl)) {
      this.enhanceSourceModeTable(tableEl, match);
      return;
    }

    const parsed = this.settings.enableFormulas
      ? applyFormulas(parseAndMerge(match.text))
      : parseAndMerge(match.text);
    renderTable(this.app, tableEl, parsed, match.sourcePath, this);
    this.applyTableMatchMetadata(tableEl, match);
    this.tableRanges.set(tableEl, match.range);

    const tableId = getTableIds(tableEl);
    this.applyInitialWidths(tableEl, tableId, match.text);

    this.setupResizer(tableEl);
    this.setupMergeInteraction(tableEl);
  }

  private enhanceSourceModeTable(tableEl: HTMLTableElement, match: TableMatch): void {
    this.applyTableMatchMetadata(tableEl, match);
    this.tableRanges.set(tableEl, match.range);
    ensureColgroup(tableEl);
    const tableId = getTableIds(tableEl);
    this.applyInitialWidths(tableEl, tableId, match.text);
    this.setupResizer(tableEl);
    this.addCellCoordinates(tableEl);
    this.applyMergePreviewToExistingTable(tableEl, match.text);
    this.setupMergeInteraction(tableEl);
  }

  private applyMergePreviewToExistingTable(tableEl: HTMLTableElement, tableText: string): void {
    const parsed = parseAndMerge(tableText);
    if (this.parsedTableHasRowspanAcrossDomSections(tableEl, parsed)) {
      return;
    }
    const cellByPosition = new Map<string, HTMLTableCellElement>();

    for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
      cell.style.display = "";
      cell.colSpan = 1;
      cell.rowSpan = 1;
    }

    this.addCellCoordinates(tableEl);
    for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
      const row = Number(cell.getAttribute("data-row"));
      const col = Number(cell.getAttribute("data-col"));
      if (!Number.isInteger(row) || !Number.isInteger(col)) continue;

      cellByPosition.set(`${row}:${col}`, cell);
    }

    for (let row = 0; row < parsed.grid.length; row++) {
      for (let col = 0; col < parsed.grid[row].length; col++) {
        const parsedCell = parsed.grid[row][col];
        const domCell = cellByPosition.get(`${row}:${col}`);
        if (!domCell) continue;

        if (parsedCell.hidden) {
          domCell.style.display = "none";
        } else {
          domCell.colSpan = parsedCell.colspan || 1;
          domCell.rowSpan = parsedCell.rowspan || 1;
        }
      }
    }
  }

  private parsedTableHasRowspanAcrossDomSections(
    tableEl: HTMLTableElement,
    parsed: ReturnType<typeof parseAndMerge>
  ): boolean {
    if (!tableEl.tHead || !tableEl.tBodies.length) {
      return false;
    }

    const headerRows = tableEl.tHead.rows.length || 1;
    for (let row = 0; row < Math.min(headerRows, parsed.grid.length); row++) {
      for (const cell of parsed.grid[row]) {
        if (!cell.hidden && cell.rowspan > 1 && row + cell.rowspan > headerRows) {
          return true;
        }
      }
    }

    return false;
  }

  private resolveTableSource(tableEl: HTMLTableElement, context: TableEnhancementContext): TableMatch | null {
    let sourceText = "";
    let range: TableRange | null = null;
    let tableOrdinal: number | undefined;

    if (context.getSectionInfo) {
      const sectionInfo = context.getSectionInfo(tableEl);
      if (sectionInfo) {
        const lines = splitMarkdownLines(sectionInfo.text);
        const sectionSpecs = extractMarkdownTableSpecs(sectionInfo.text);
        const matched = matchMarkdownTableSpecForElement(sectionSpecs, tableEl);
        if (matched) {
          const offset = sectionInfo.lineStart + matched.range.startLine;
          sourceText = matched.text;
          range = {
            startLine: offset,
            endLine: offset + (matched.range.endLine - matched.range.startLine),
          };
          tableOrdinal = matched.tableOrdinal;
        } else if (lines.length) {
          sourceText = sectionInfo.text;
          range = {
            startLine: sectionInfo.lineStart,
            endLine: sectionInfo.lineEnd,
          };
        }
      }
    }

    if (!sourceText) {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view && view.editor) {
        const fullDoc = view.editor.getValue();
        const match =
          this.findTableInSource(fullDoc, tableEl) ||
          this.findMergeTableInDocument(fullDoc, tableEl, context.sourcePath || "");
        sourceText = match?.text || "";
        range = match?.range || null;
        tableOrdinal = match?.tableOrdinal;
      }
    }

    if (!sourceText || !range) return null;

    return { text: sourceText, range, sourcePath: context.sourcePath || "", tableOrdinal };
  }

  private enhancePlainTable(
    tableEl: HTMLTableElement,
    context: TableEnhancementContext,
    existingMatch: TableMatch | null
  ): void {
    ensureColgroup(tableEl);

    const match = existingMatch || this.resolveTableSource(tableEl, context);
    if (match) {
      this.applyTableMatchMetadata(tableEl, match);
      this.tableRanges.set(tableEl, match.range);
    } else {
      const range = this.getRangeForPlainTable(tableEl);
      if (range) {
        this.tableRanges.set(tableEl, range);
      }
    }

    const tableId = getTableIds(tableEl);
    this.applyInitialWidths(tableEl, tableId, match?.text || "");

    this.setupResizer(tableEl);
    this.addCellCoordinates(tableEl);
    this.setupMergeInteraction(tableEl);
  }

  private addCellCoordinates(tableEl: HTMLTableElement): void {
    const occupied = new Map<string, true>();
    for (let rowIndex = 0; rowIndex < tableEl.rows.length; rowIndex++) {
      const row = tableEl.rows[rowIndex];
      let logicalCol = 0;
      for (const cell of Array.from(row.cells)) {
        while (occupied.has(`${rowIndex}:${logicalCol}`)) {
          logicalCol++;
        }
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

  private setupMergeInteraction(tableEl: HTMLTableElement): void {
    installMergeInteraction({
      app: this.app,
      component: this,
      getTableRange: (table) => this.tableRanges.get(table) || null,
        setActiveSelection: (context) => {
          this.activeMergeSelection = context;
        },
        onDocumentChanged: () => this.scheduleLivePreviewRefresh(0),
      }, tableEl);
  }

  private getRangeForPlainTable(tableEl: HTMLTableElement): TableRange | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.editor) return null;

    const match = this.findTableInSource(view.editor.getValue(), tableEl);
    return match?.range || null;
  }

  private runActiveMergeCommand(checking: boolean, direction: "horizontal" | "vertical"): boolean {
    const active = this.activeMergeSelection;
    if (!active || !active.tableEl.isConnected) return false;

    const range = this.tableRanges.get(active.tableEl) || null;
    if (!range) return false;
    const selection = expandSelectionForDirection(active.tableEl, active.selection, direction);
    if (!selection) return false;
    if (!checking) {
      if (runMergeCommand(this.app, direction, range, selection)) {
        this.scheduleLivePreviewRefresh(0);
      }
    }
    return true;
  }

  private addMergeItemsToEditorMenu(menu: any): void {
    const active = this.activeMergeSelection;
    if (!active || !active.tableEl.isConnected) return;

    const range = this.tableRanges.get(active.tableEl) || null;
    if (!range) return;

    const horizontalSelection = expandSelectionForDirection(active.tableEl, active.selection, "horizontal");
    const verticalSelection = expandSelectionForDirection(active.tableEl, active.selection, "vertical");
    const unmergeSelection = expandSelectionForUnmerge(active.tableEl, active.selection);
    menu.addSeparator?.();
    menu.addItem((item: any) => {
      item
        .setTitle("Merge selected cells horizontally")
        .setIcon("columns-3")
        .setDisabled(!horizontalSelection)
        .onClick(() => {
          if (runMergeCommand(this.app, "horizontal", range, horizontalSelection)) {
            this.scheduleLivePreviewRefresh(0);
          }
        });
    });
    menu.addItem((item: any) => {
      item
        .setTitle("Merge selected cells vertically")
        .setIcon("rows-3")
        .setDisabled(!verticalSelection)
        .onClick(() => {
          if (runMergeCommand(this.app, "vertical", range, verticalSelection)) {
            this.scheduleLivePreviewRefresh(0);
          }
        });
    });
    menu.addItem((item: any) => {
      item
        .setTitle("Unmerge selected cells")
        .setIcon("split-square-horizontal")
        .onClick(() => {
          if (runUnmergeCommand(this.app, range, unmergeSelection)) {
            this.scheduleLivePreviewRefresh(0);
          }
        });
    });
  }

  private runActiveUnmergeCommand(checking: boolean): boolean {
    const active = this.activeMergeSelection;
    if (!active || !active.tableEl.isConnected) return false;

    const range = this.tableRanges.get(active.tableEl) || null;
    if (!range) return false;
    const selection = expandSelectionForUnmerge(active.tableEl, active.selection);
    if (!checking) {
      if (runUnmergeCommand(this.app, range, selection)) {
        this.scheduleLivePreviewRefresh(0);
      }
    }
    return true;
  }

  /**
   * Locate the raw markdown table block corresponding to a rendered table.
   * Prefer unique content/body/header signatures over brittle
   * "header text appears in a line" matching.
   */
  private findTableInSource(fullDoc: string, tableEl: HTMLTableElement): { text: string; range: TableRange; tableOrdinal?: number } | null {
    const tableSpecs = extractMarkdownTableSpecs(fullDoc);
    const sourceLine = this.getSourceLineForTable(tableEl);
    if (sourceLine !== null && Number.isInteger(sourceLine)) {
      const sourceLineMatch = tableSpecs.find(
        (spec) => sourceLine >= spec.range.startLine && sourceLine <= spec.range.endLine
      );
      if (sourceLineMatch && hasMergeMarkers(sourceLineMatch.text)) {
        return {
          text: sourceLineMatch.text,
          range: sourceLineMatch.range,
          tableOrdinal: sourceLineMatch.tableOrdinal,
        };
      }
    }

    const matched = matchMarkdownTableSpecForElement(tableSpecs, tableEl, sourceLine);
    return matched ? { text: matched.text, range: matched.range, tableOrdinal: matched.tableOrdinal } : null;
  }

  private setupResizer(tableEl: HTMLTableElement) {
    makeTableResizable(this, tableEl, {
      onResizeStart: () => {
        this.resizingTables.add(tableEl);
        if (this.refreshTimer !== null) {
          window.clearTimeout(this.refreshTimer);
          this.refreshTimer = null;
        }
      },
      onResizeEnd: (widths) => {
        this.resizingTables.delete(tableEl);
        const currentTableId = getTableIds(tableEl);
        if (!this.writeWidthsToMarkdown(tableEl, widths)) {
          saveWidths(this, currentTableId, widths);
        }
        this.syncWidthsAcrossOpenViews(tableEl, currentTableId, widths);
      },
    });
  }

  private syncWidthsAcrossOpenViews(
    sourceTable: HTMLTableElement,
    fallbackSourceTableIds: string[],
    widths: (number | null)[]
  ): void {
    const sourcePath =
      sourceTable.getAttribute("data-source-path") ||
      this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path ||
      "";
    if (!sourcePath) return;

    const sourceTableIds = this.ensureTableMetadata(sourceTable, sourcePath);
    const matchIds = sourceTableIds.length ? sourceTableIds : fallbackSourceTableIds;

    for (const tableEl of this.getOpenMarkdownTables(sourcePath)) {
      if (tableEl === sourceTable || tableEl.hasAttribute("data-resizing")) continue;

      const tableIds = this.ensureTableMetadata(tableEl, sourcePath);
      if (!this.haveSharedTableId(matchIds, tableIds)) continue;

      ensureColgroup(tableEl);
      applySavedWidths(tableEl, widths);
    }
  }

  private getOpenMarkdownTables(sourcePath: string): HTMLTableElement[] {
    const leaves = this.app.workspace.getLeavesOfType?.("markdown") || [];
    const tables: HTMLTableElement[] = [];

    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView | undefined;
      if (view?.file?.path !== sourcePath || !view.contentEl) continue;
      tables.push(
        ...Array.from(
          view.contentEl.querySelectorAll("table")
        ).filter((table): table is HTMLTableElement => table instanceof HTMLTableElement)
      );
    }

    return tables;
  }

  private ensureTableMetadata(tableEl: HTMLTableElement, sourcePath: string): string[] {
    let tableIds = getTableIds(tableEl);
    const hasStableId = tableIds.some((id) => !id.startsWith("table-fallback-"));
    if (hasStableId) return tableIds;

    const match = this.resolveTableSource(tableEl, { sourcePath });
    if (match) {
      this.applyTableMatchMetadata(tableEl, match);
      this.tableRanges.set(tableEl, match.range);
      tableIds = getTableIds(tableEl);
    }

    return tableIds;
  }

  private haveSharedTableId(left: string[], right: string[]): boolean {
    const rightIds = new Set(right);
    return left.some((id) => rightIds.has(id));
  }

  private applyInitialWidths(tableEl: HTMLTableElement, tableId: string | string[], tableText: string): void {
    const savedWidths = loadWidths(this, tableId);
    if (savedWidths) {
      applySavedWidths(tableEl, savedWidths);
      return;
    }

    if (this.settings.widthPersistence === "markdown" && tableText) {
      const specs = extractMarkdownTableSpecs(tableText);
      const spec = specs[0];
      if (spec?.columns.length) {
        applySavedWidths(
          tableEl,
          spec.columns.map((column) => column.dashCount * this.settings.pixelsPerDash)
        );
        return;
      }
    }
  }

  private writeWidthsToMarkdown(tableEl: HTMLTableElement, widths: (number | null)[]): boolean {
    if (this.settings.widthPersistence !== "markdown") return false;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.editor;
    const range = this.tableRanges.get(tableEl);
    if (!editor || !range) return false;

    const separatorLineIndex = range.startLine + 1;
    const currentLine = editor.getLine(separatorLineIndex);
    const nextLine = buildSeparatorLineForWidths(
      currentLine,
      widths,
      this.settings.pixelsPerDash
    );
    if (!nextLine || nextLine === currentLine) return false;

    editor.replaceRange(
      nextLine,
      { line: separatorLineIndex, ch: 0 },
      { line: separatorLineIndex, ch: currentLine.length }
    );
    editor.setCursor({ line: separatorLineIndex, ch: 0 });
    return true;
  }

  private scheduleLivePreviewRefresh(delay = 80): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshLivePreviewTables();
    }, delay);
  }

  private refreshLivePreviewTables(): void {
    if (!this.settings.nativeProcessing) return;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.contentEl) return;

    const sourcePath = view.file?.path || "";
    const tables = Array.from(
      view.contentEl.querySelectorAll("table:not([id='sheet-extend-parsed'])")
    ).filter((table): table is HTMLTableElement => table instanceof HTMLTableElement);

    for (const tableEl of tables) {
      if (tableEl.hasAttribute("data-resizing") || this.resizingTables.has(tableEl)) {
        continue;
      }
      this.processTable(tableEl, { sourcePath });
    }
  }

  private observeWorkspaceTables(): void {
    this.observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) =>
          node instanceof HTMLElement && (node.matches("table") || !!node.querySelector("table"))
        )
      )) {
        this.scheduleLivePreviewRefresh();
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.observer?.disconnect());
  }

  onunload() {
    document.body.classList.remove("sheet-extend-resizing");
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.observer?.disconnect();
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
    const savedVersion = data?.version || "0.0.0";

    if (savedVersion !== "1.3.0") {
      this.widthStore = {};
      await this.saveData({
        version: "1.3.0",
        settings: this.settings,
        columnWidths: {},
      });
    } else {
      this.widthStore = data?.columnWidths || {};
    }
  }

  async saveSettings() {
    await this.saveData({
      version: "1.3.0",
      settings: this.settings,
      columnWidths: this.widthStore,
    });
  }
}
