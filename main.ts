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
  private findTableInDocument(docText: string, tableEl: HTMLTableElement): string | null {
    const lines = docText.split("\n");
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
          return blockText;
        }
      }
    }

    // If no merge-marker table found, return null (no special processing needed)
    return null;
  }

  private processTable(tableEl: HTMLTableElement, context: any) {
    const tableId = getTableId(tableEl);

    let sourceText = "";
    if (context.getSectionInfo) {
      const sectionInfo = context.getSectionInfo(tableEl);
      if (sectionInfo) {
        const lines = sectionInfo.text.split("\n");
        sourceText = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1).join("\n");
      }
    }

    // Fallback: when getSectionInfo fails (common in Live Preview mode),
    // read directly from the editor to get raw markdown source.
    // This avoids the issue where Obsidian's Live Preview engine processes
    // "^" as a footnote marker, causing it to disappear from the DOM.
    if (!sourceText) {
      const docText = this.getSourceFromEditor();
      if (docText) {
        const found = this.findTableInDocument(docText, tableEl);
        if (found) {
          sourceText = found;
        }
      }
    }

    // Final fallback: reconstruct from DOM (may lose ^ markers in Live Preview)
    if (!sourceText) {
      const rows: string[] = [];
      for (const tr of Array.from(tableEl.querySelectorAll("tr"))) {
        const cells: string[] = [];
        for (const td of Array.from(tr.querySelectorAll("th, td"))) {
          // Use innerHTML to preserve HTML tags (e.g. <font>, <br>)
          // instead of textContent which strips them
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

    if (savedVersion !== "1.2.0") {
      this.widthStore = {};
      await this.saveData({
        version: "1.2.0",
        settings: this.settings,
        columnWidths: {},
      });
    } else {
      this.widthStore = data?.columnWidths || {};
    }
  }

  async saveSettings() {
    await this.saveData({
      version: "1.2.0",
      settings: this.settings,
      columnWidths: this.widthStore,
    });
  }
}
