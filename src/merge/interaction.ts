import { Menu, MarkdownView, type App, type Component, type Editor } from "obsidian";
import {
  applyMergeToDocument,
  clearMergeInDocument,
  type CellPosition,
  type CellSelection,
  type MergeDirection,
  type TableRange,
} from "../sheet/writeback";

interface MergeActionContext {
  tableEl: HTMLTableElement;
  selection: CellSelection;
}

export interface MergeInteractionHost {
  app: App;
  component: Component;
  getTableRange(tableEl: HTMLTableElement): TableRange | null;
  setActiveSelection(context: MergeActionContext): void;
}

type RegisteredElement = HTMLTableElement & { sheetExtendMergeInteraction?: MergeInteraction };

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
    this.writeSelection((doc, range, selection) => applyMergeToDocument(doc, range, selection, direction).text);
    return true;
  }

  unmerge(): boolean {
    if (!this.selection) return false;
    this.writeSelection((doc, range, selection) => clearMergeInDocument(doc, range, selection).text);
    return true;
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
    menu.addItem((item) => {
      item
        .setTitle("Merge selected cells horizontally (Mod+Shift+Right)")
        .setIcon("columns-3")
        .setDisabled(!selectionHasHorizontalSpan(selection))
        .onClick(() => this.merge("horizontal"));
    });
    menu.addItem((item) => {
      item
        .setTitle("Merge selected cells vertically (Mod+Shift+Down)")
        .setIcon("rows-3")
        .setDisabled(!selectionHasVerticalSpan(selection))
        .onClick(() => this.merge("vertical"));
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item
        .setTitle("Unmerge selected cells (Mod+Shift+Left)")
        .setIcon("split-square-horizontal")
        .onClick(() => this.unmerge());
    });
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
    if (!editor || !range) return;

    const nextText = getNextDocument(editor.getValue(), range, this.selection);
    editor.setValue(nextText);
    editor.setCursor({ line: range.startLine, ch: 0 });
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
  if (!editor || !range || !selection) return false;

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
  if (!editor || !range || !selection) return false;

  editor.setValue(clearMergeInDocument(editor.getValue(), range, selection).text);
  editor.setCursor({ line: range.startLine, ch: 0 });
  return true;
}
