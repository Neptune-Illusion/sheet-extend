import { Menu, MarkdownView, Notice, type App, type Component, type Editor } from "obsidian";
import {
  applyMergeToDocument,
  clearMergeInDocument,
  replaceTableRange,
  type CellPosition,
  type CellSelection,
  type MergeDirection,
  type TableRange,
} from "../sheet/writeback";
import { setTableAlignment, type TableAlignment } from "../sheet/table-style";
import {
  extractMarkdownTableSpecs,
  matchMarkdownTableSpecForElement,
  type MarkdownTableSpec,
} from "../sheet/markdown-table";

interface MergeActionContext {
  tableEl: HTMLTableElement;
  selection: CellSelection;
}

export interface MergeInteractionHost {
  app: App;
  component: Component;
  getTableRange(tableEl: HTMLTableElement): TableRange | null;
  setActiveSelection(context: MergeActionContext): void;
  onDocumentChanged?(): void;
}

type RegisteredElement = HTMLTableElement & { sheetExtendMergeInteraction?: MergeInteraction };

export async function resolveTableIdentityFromVault(
  app: App,
  tableEl: HTMLTableElement,
  sourcePathHint?: string
): Promise<Pick<MarkdownTableSpec, "range" | "tableOrdinal"> | null> {
  const sourcePath = tableEl.getAttribute("data-source-path") || sourcePathHint;
  if (!sourcePath) return null;
  const vault = (app as any).vault;
  const file = vault?.getAbstractFileByPath?.(sourcePath);
  // cachedRead caches per file path, so a document with N tables that all fall
  // through to this path reads from disk once instead of N times.
  const read = vault?.cachedRead || vault?.read;
  if (!file || !read) return null;
  const docText = await read.call(vault, file);
  const specs = extractMarkdownTableSpecs(docText);
  if (!specs.length) return null;
  const probe = tableEl.cloneNode(true) as HTMLTableElement;
  probe.removeAttribute("data-line-start");
  delete probe.dataset.sheetExtendTableOrdinal;
  const matched = matchMarkdownTableSpecForElement(specs, probe, null);
  return matched ? { range: matched.range, tableOrdinal: matched.tableOrdinal } : null;
}

export async function resolveTableRangeFromVault(
  app: App,
  tableEl: HTMLTableElement
): Promise<TableRange | null> {
  const identity = await resolveTableIdentityFromVault(app, tableEl);
  return identity?.range || null;
}

export async function writeTableUsingVault(
  app: App,
  sourcePath: string,
  range: TableRange,
  selection: CellSelection,
  transform: (documentText: string, range: TableRange, selection: CellSelection) => string
): Promise<boolean> {
  const vault = (app as any).vault;
  const file = sourcePath && vault?.getAbstractFileByPath?.(sourcePath);
  if (!file || !vault?.process) return false;
  await vault.process(file, (documentText: string) => transform(documentText, range, selection));
  return true;
}

function getActiveSourcePath(app: App): string | null {
  const workspace = (app as any).workspace;
  const activeFile = workspace?.getActiveFile?.();
  if (activeFile?.path) return activeFile.path;
  const view = workspace?.activeLeaf?.view;
  return view?.file?.path || null;
}

function isSourceModeTable(tableEl: HTMLTableElement): boolean {
  return !!tableEl.closest(".markdown-source-view, .cm-table-widget");
}

function getCellPosition(cell: HTMLElement): CellPosition | null {
  const row = Number(cell.getAttribute("data-row"));
  const col = Number(cell.getAttribute("data-col"));
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row, col };
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

function containsPosition(selection: CellSelection, position: CellPosition): boolean {
  const bounds = normalizeSelection(selection);
  return (
    position.row >= bounds.rowStart &&
    position.row <= bounds.rowEnd &&
    position.col >= bounds.colStart &&
    position.col <= bounds.colEnd
  );
}

function selectionHasHorizontalSpan(selection: CellSelection): boolean {
  const bounds = normalizeSelection(selection);
  return bounds.colEnd > bounds.colStart;
}

function selectionHasVerticalSpan(selection: CellSelection): boolean {
  const bounds = normalizeSelection(selection);
  return bounds.rowEnd > bounds.rowStart;
}

function getTableBounds(tableEl: HTMLTableElement): { maxRow: number; maxCol: number } {
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
    const position = getCellPosition(cell);
    if (!position) continue;
    maxRow = Math.max(maxRow, position.row);
    maxCol = Math.max(maxCol, position.col + (cell.colSpan || 1) - 1);
  }
  return { maxRow, maxCol };
}

function expandSelectionForDirection(
  tableEl: HTMLTableElement,
  selection: CellSelection,
  direction: MergeDirection
): CellSelection | null {
  if (direction === "horizontal" && selectionHasHorizontalSpan(selection)) return selection;
  if (direction === "vertical" && selectionHasVerticalSpan(selection)) return selection;

  const bounds = getTableBounds(tableEl);
  if (direction === "horizontal" && selection.focus.col < bounds.maxCol) {
    return { anchor: selection.anchor, focus: { row: selection.focus.row, col: selection.focus.col + 1 } };
  }
  if (direction === "vertical" && selection.focus.row < bounds.maxRow) {
    return { anchor: selection.anchor, focus: { row: selection.focus.row + 1, col: selection.focus.col } };
  }
  return null;
}

function expandSelectionForUnmerge(tableEl: HTMLTableElement, selection: CellSelection): CellSelection {
  const bounds = normalizeSelection(selection);

  for (const cell of Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[]) {
    const position = getCellPosition(cell);
    if (!position) continue;

    const rowEnd = position.row + (cell.rowSpan || 1) - 1;
    const colEnd = position.col + (cell.colSpan || 1) - 1;
    const intersects = (
      position.row <= bounds.rowEnd &&
      rowEnd >= bounds.rowStart &&
      position.col <= bounds.colEnd &&
      colEnd >= bounds.colStart
    );
    if (!intersects) continue;

    bounds.rowStart = Math.min(bounds.rowStart, position.row);
    bounds.rowEnd = Math.max(bounds.rowEnd, rowEnd);
    bounds.colStart = Math.min(bounds.colStart, position.col);
    bounds.colEnd = Math.max(bounds.colEnd, colEnd);
  }

  return {
    anchor: { row: bounds.rowStart, col: bounds.colStart },
    focus: { row: bounds.rowEnd, col: bounds.colEnd },
  };
}

function getEditor(app: App): Editor | null {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  return view?.editor || null;
}

class MergeInteraction {
  private selection: CellSelection | null = null;

  constructor(private host: MergeInteractionHost, private tableEl: HTMLTableElement) {
    this.tableEl.classList.add("sheet-extend-merge-enabled");
    this.host.component.registerDomEvent(this.tableEl, "click", this.handleClick);
    this.host.component.registerDomEvent(this.tableEl, "contextmenu", this.handleContextMenu);
  }

  getSelection(): CellSelection | null {
    return this.selection;
  }

  merge(direction: MergeDirection): boolean {
    if (!this.selection) return false;
    const selection = expandSelectionForDirection(this.tableEl, this.selection, direction);
    if (!selection) return false;
    this.writeSelection((doc, range) => applyMergeToDocument(doc, range, selection, direction).text);
    return true;
  }

  unmerge(): boolean {
    if (!this.selection) return false;
    // Resolve the complete span from source markdown so covered DOM cells do
    // not need to exist for unmerge to work.
    this.writeSelection((doc, range) => clearMergeInDocument(doc, range, this.selection!).text);
    return true;
  }

  private align(alignment: TableAlignment): void {
    const range = this.host.getTableRange(this.tableEl);
    if (range) {
      this.doAlign(alignment, range);
      return;
    }
    void resolveTableRangeFromVault(this.host.app, this.tableEl).then((resolved) => {
      if (!resolved) {
        new Notice("Could not locate the table source. Try switching to editing mode.");
        return;
      }
      this.doAlign(alignment, resolved);
    });
  }

  private doAlign(alignment: TableAlignment, range: TableRange): void {
    const transform = (docText: string): string => {
      const lines = docText.split(/\r?\n/);
      const lineEnding = docText.includes("\r\n") ? "\r\n" : "\n";
      const tableText = lines.slice(range.startLine, range.endLine + 1).join(lineEnding);
      const aligned = setTableAlignment(tableText, alignment);
      return replaceTableRange(docText, range, aligned);
    };

    const editor = getEditor(this.host.app);
    if (!editor) {
      const sourcePath = this.tableEl.getAttribute("data-source-path");
      if (!sourcePath) {
        new Notice("Could not locate the table source. Try switching to editing mode.");
        return;
      }
      // ponytail: selection unused — alignment operates on the separator row, not cell selection
      void writeTableUsingVault(this.host.app, sourcePath, range,
        { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } },
        (docText) => transform(docText)
      ).then((written) => {
        if (written) this.host.onDocumentChanged?.();
      });
      return;
    }

    editor.setValue(transform(editor.getValue()));
    editor.setCursor({ line: range.startLine, ch: 0 });
    this.host.onDocumentChanged?.();
  }

  private handleClick = (evt: MouseEvent): void => {
    const target = evt.target as HTMLElement;
    if (target.closest(".sheet-extend-resizer")) return;

    const cell = target.closest("th, td") as HTMLElement | null;
    if (!cell || !this.tableEl.contains(cell)) return;

    const position = getCellPosition(cell);
    if (!position) return;

    if (evt.shiftKey && this.selection) {
      this.selection = { anchor: this.selection.anchor, focus: position };
    } else {
      this.selection = { anchor: position, focus: position };
    }

    this.host.setActiveSelection({ tableEl: this.tableEl, selection: this.selection });
    this.paintSelection();
  };

  private handleContextMenu = (evt: MouseEvent): void => {
    const cell = (evt.target as HTMLElement).closest("th, td") as HTMLElement | null;
    if (!cell || !this.tableEl.contains(cell)) return;

    const position = getCellPosition(cell);
    if (!position) return;

    if (!this.selection || !containsPosition(this.selection, position)) {
      this.selection = { anchor: position, focus: position };
      this.paintSelection();
    }

    this.host.setActiveSelection({ tableEl: this.tableEl, selection: this.selection });
    if (!isSourceModeTable(this.tableEl)) {
      evt.preventDefault();
      this.showMenu(evt);
    }
  };

  private showMenu(evt: MouseEvent): void {
    const selection = this.selection;
    if (!selection) return;

    const menu = new Menu();
    const horizontalSelection = expandSelectionForDirection(this.tableEl, selection, "horizontal");
    const verticalSelection = expandSelectionForDirection(this.tableEl, selection, "vertical");
    menu.addItem((item) => {
      item
        .setTitle("Merge selected cells horizontally (Mod+Shift+Right)")
        .setIcon("columns-3")
        .setDisabled(!horizontalSelection)
        .onClick(() => this.merge("horizontal"));
    });
    menu.addItem((item) => {
      item
        .setTitle("Merge selected cells vertically (Mod+Shift+Down)")
        .setIcon("rows-3")
        .setDisabled(!verticalSelection)
        .onClick(() => this.merge("vertical"));
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item
        .setTitle("Unmerge selected cells (Mod+Shift+Left)")
        .setIcon("split-square-horizontal")
        .onClick(() => this.unmerge());
    });

    menu.addSeparator();
    for (const alignment of ["center", "left", "right"] as TableAlignment[]) {
      menu.addItem((item) => {
        item
          .setTitle(`Align table ${alignment}`)
          .setIcon(alignment === "center" ? "align-center" : alignment === "left" ? "align-left" : "align-right")
          .onClick(() => this.align(alignment));
      });
    }
    menu.showAtMouseEvent(evt);
  }

  private paintSelection(): void {
    const selection = this.selection;
    for (const cell of Array.from(this.tableEl.querySelectorAll("th, td")) as HTMLElement[]) {
      const position = getCellPosition(cell);
      const selected = !!selection && !!position && containsPosition(selection, position);
      cell.toggleClass("sheet-extend-cell-selected", selected);
    }
  }

  private writeSelection(
    getNextDocument: (documentText: string, range: TableRange, selection: CellSelection) => string
  ): void {
    if (!this.selection) return;
    const editor = getEditor(this.host.app);
    const range = this.host.getTableRange(this.tableEl);
    if (range) {
      this.doWriteSelection(editor, range, this.selection, getNextDocument);
      return;
    }
    void resolveTableRangeFromVault(this.host.app, this.tableEl).then((resolved) => {
      if (!resolved) {
        new Notice("Could not locate the table source. Try switching to editing mode.");
        return;
      }
      this.doWriteSelection(editor, resolved, this.selection!, getNextDocument);
    });
  }

  private doWriteSelection(
    editor: Editor | null,
    range: TableRange,
    selection: CellSelection,
    getNextDocument: (documentText: string, range: TableRange, selection: CellSelection) => string
  ): void {
    if (!editor) {
      const sourcePath = this.tableEl.getAttribute("data-source-path");
      if (!sourcePath) {
        new Notice("Could not locate the table source. Try switching to editing mode.");
        return;
      }
      void writeTableUsingVault(this.host.app, sourcePath, range, selection,
        getNextDocument).then((written) => {
          if (written) this.host.onDocumentChanged?.();
        });
      return;
    }

    const nextText = getNextDocument(editor.getValue(), range, selection);
    editor.setValue(nextText);
    editor.setCursor({ line: range.startLine, ch: 0 });
    this.host.onDocumentChanged?.();
  }
}

export function installMergeInteraction(host: MergeInteractionHost, tableEl: HTMLTableElement): void {
  const registered = tableEl as RegisteredElement;
  if (registered.sheetExtendMergeInteraction) return;
  registered.sheetExtendMergeInteraction = new MergeInteraction(host, tableEl);
}

export function runMergeCommand(
  app: App,
  direction: MergeDirection,
  range: TableRange | null,
  selection: CellSelection | null
): boolean {
  const editor = getEditor(app);
  if (!range || !selection) return false;

  if (!editor) {
    const sourcePath = getActiveSourcePath(app);
    if (!sourcePath) return false;
    void writeTableUsingVault(app, sourcePath, range, selection,
      (documentText, tableRange, cellSelection) =>
        applyMergeToDocument(documentText, tableRange, cellSelection, direction).text);
    return true;
  }

  editor.setValue(applyMergeToDocument(editor.getValue(), range, selection, direction).text);
  editor.setCursor({ line: range.startLine, ch: 0 });
  return true;
}

export function runUnmergeCommand(
  app: App,
  range: TableRange | null,
  selection: CellSelection | null
): boolean {
  const editor = getEditor(app);
  if (!range || !selection) return false;

  if (!editor) {
    const sourcePath = getActiveSourcePath(app);
    if (!sourcePath) return false;
    void writeTableUsingVault(app, sourcePath, range, selection,
      (documentText, tableRange, cellSelection) =>
        clearMergeInDocument(documentText, tableRange, cellSelection).text);
    return true;
  }

  editor.setValue(clearMergeInDocument(editor.getValue(), range, selection).text);
  editor.setCursor({ line: range.startLine, ch: 0 });
  return true;
}
