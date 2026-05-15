import { Plugin, MarkdownView, MarkdownRenderChild } from "obsidian";
import { SheetExtendSettings, DEFAULT_SETTINGS, SheetExtendSettingTab } from "./src/settings";
import { parseAndMerge } from "./src/sheet/parser";
import { renderTable } from "./src/sheet/renderer";
import { hasMergeMarkers } from "./src/sheet/detect";
import { makeTableResizable } from "./src/resizer/resizer";
import { getTableId, saveWidths, loadWidths, applySavedWidths } from "./src/resizer/persistence";

class SheetExtendRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private app: import("obsidian").App,
    private sourcePath: string,
    private content: string
  ) {
    super(containerEl);
  }

  onload() {
    const tableEl = this.containerEl.createEl("table");
    const parsed = parseAndMerge(this.content);
    renderTable(this.app, tableEl, parsed, this.sourcePath, this);
  }
}

export default class SheetExtendPlugin extends Plugin {
  settings: SheetExtendSettings;
  widthStore: { [tableId: string]: (number | null)[] } = {};

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SheetExtendSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((element, context) => {
      if (!this.settings.nativeProcessing) return;
      if (!this.app.workspace.getActiveViewOfType(MarkdownView)) return;

      const tables = Array.from(element.querySelectorAll("table:not([id='obsidian-sheets-parsed'])"));
      for (const tableEl of tables) {
        this.processTable(tableEl as HTMLTableElement, context);
      }
    });

    this.registerMarkdownCodeBlockProcessor("sheet", (source, el, ctx) => {
      const parsed = parseAndMerge(source);
      const tableEl = el.createEl("table");
      renderTable(this.app, tableEl, parsed, ctx.sourcePath, this);
      this.setupResizer(tableEl);
    });
  }

  private processTable(tableEl: HTMLTableElement, context: any) {
    const tableId = getTableId(tableEl);

    let sourceText = "";

    // Strategy 1: getSectionInfo() — works in Reading mode
    if (context.getSectionInfo) {
      const sectionInfo = context.getSectionInfo(tableEl);
      if (sectionInfo) {
        const lines = sectionInfo.text.split("\n");
        sourceText = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1).join("\n");
      }
    }

    // Strategy 2: Read raw markdown from the editor document.
    // Fallback when getSectionInfo returns null (e.g. in Live Preview or
    // certain embedded contexts). The editor's raw text preserves merge markers.
    if (!sourceText) {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view && view.editor) {
        const fullDoc = view.editor.getValue();
        sourceText = this.findTableInSource(fullDoc, tableEl);
      }
    }

    // Strategy 3: DOM innerHTML fallback — last resort
    if (!sourceText) {
      const rows: string[] = [];
      for (const tr of Array.from(tableEl.querySelectorAll("tr"))) {
        const cells: string[] = [];
        for (const td of Array.from(tr.querySelectorAll("th, td"))) {
          cells.push((td as HTMLElement).innerHTML || "");
        }
        rows.push("| " + cells.join(" | ") + " |");
      }
      sourceText = rows.join("\n");
      if (rows.length > 1) {
        const colCount = tableEl.querySelector("tr")?.children.length || 1;
        const delim = "| " + Array(colCount).fill("---").join(" | ") + " |";
        sourceText = rows[0] + "\n" + delim + "\n" + rows.slice(1).join("\n");
      }
    }

    if (!hasMergeMarkers(sourceText)) {
      const savedWidths = loadWidths(this, tableId);
      if (savedWidths) {
        applySavedWidths(tableEl, savedWidths);
      }
      this.setupResizer(tableEl);
      return;
    }

    const parsed = parseAndMerge(sourceText);
    renderTable(this.app, tableEl, parsed, context.sourcePath || "", this);

    const savedWidths = loadWidths(this, tableId);
    if (savedWidths) {
      applySavedWidths(tableEl, savedWidths);
    }

    this.setupResizer(tableEl);
  }

  /**
   * Locate the raw markdown table block in the full document source that
   * corresponds to the rendered table element. Matches by comparing the
   * text content of the first header row cells against source lines.
   */
  private findTableInSource(fullDoc: string, tableEl: HTMLTableElement): string {
    const lines = fullDoc.split("\n");

    const headerRow = tableEl.querySelector("tr");
    if (!headerRow) return "";
    const headerCells: string[] = [];
    for (const th of Array.from(headerRow.querySelectorAll("th, td"))) {
      const text = (th as HTMLElement).textContent?.trim() || "";
      if (text) headerCells.push(text);
    }
    if (headerCells.length === 0) return "";

    let tableStartIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("|")) continue;
      const allMatch = headerCells.every((cell) => line.includes(cell));
      if (allMatch) {
        tableStartIdx = i;
        break;
      }
    }

    if (tableStartIdx < 0) return "";

    let tableEndIdx = tableStartIdx;
    for (let i = tableStartIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("|")) {
        tableEndIdx = i;
      } else {
        break;
      }
    }

    return lines.slice(tableStartIdx, tableEndIdx + 1).join("\n");
  }

  private setupResizer(tableEl: HTMLTableElement) {
    const tableId = getTableId(tableEl);
    makeTableResizable(this, tableEl, (widths) => {
      saveWidths(this, tableId, widths);
    });
  }

  onunload() {
    document.body.classList.remove("sheet-extend-resizing");
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
