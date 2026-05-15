var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SheetExtendPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  minWidth: 50,
  maxWidth: 500,
  defaultWidth: 150,
  nativeProcessing: true
};
var SheetExtendSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  get settings() {
    return this.plugin.settings;
  }
  updateSettings(changes) {
    return __async(this, null, function* () {
      Object.assign(this.plugin.settings, changes);
      yield this.plugin.saveSettings();
    });
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Sheet Extend Settings" });
    new import_obsidian.Setting(containerEl).setName("Minimum column width").setDesc("Minimum width for a resized column (px)").addSlider(
      (slider) => slider.setLimits(30, 100, 5).setValue(this.settings.minWidth).onChange((value) => __async(this, null, function* () {
        yield this.updateSettings({ minWidth: value });
      }))
    );
    new import_obsidian.Setting(containerEl).setName("Maximum column width").setDesc("Maximum width for a resized column (px)").addSlider(
      (slider) => slider.setLimits(200, 800, 10).setValue(this.settings.maxWidth).onChange((value) => __async(this, null, function* () {
        yield this.updateSettings({ maxWidth: value });
      }))
    );
    new import_obsidian.Setting(containerEl).setName("Default column width").setDesc("Default column width when resized (px)").addSlider(
      (slider) => slider.setLimits(80, 300, 5).setValue(this.settings.defaultWidth).onChange((value) => __async(this, null, function* () {
        yield this.updateSettings({ defaultWidth: value });
      }))
    );
    new import_obsidian.Setting(containerEl).setName("Enable native table processing").setDesc("Automatically process all markdown tables (not just sheet code blocks)").addToggle(
      (toggle) => toggle.setValue(this.settings.nativeProcessing).onChange((value) => __async(this, null, function* () {
        yield this.updateSettings({ nativeProcessing: value });
      }))
    );
  }
};

// src/sheet/parser.ts
function parseTable(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { grid: [], alignments: [] };
  }
  const rawRows = lines.map((line) => {
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
  const alignments = [];
  if (delimIdx >= 0) {
    for (const cell of rawRows[delimIdx]) {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right)
        alignments.push("center");
      else if (right)
        alignments.push("right");
      else if (left)
        alignments.push("left");
      else
        alignments.push("default");
    }
  }
  const dataRows = delimIdx >= 0 ? rawRows.slice(delimIdx + 1) : rawRows.slice(1);
  const headerRows = delimIdx > 0 ? rawRows.slice(0, delimIdx) : [rawRows[0]];
  const colCount = Math.max(...dataRows.map((r) => r.length), ...headerRows.map((r) => r.length));
  const verticalHeaderCols = Array(colCount).fill(true);
  for (const row of dataRows) {
    for (let c = 0; c < colCount; c++) {
      const cell = (c < row.length ? row[c] : "").replace(/[`*_~]/g, "");
      if (cell !== "" && !/^:?-{3,}:?$/.test(cell)) {
        verticalHeaderCols[c] = false;
      }
    }
  }
  const grid = [];
  for (const row of headerRows) {
    const gridRow = [];
    for (let c = 0; c < colCount; c++) {
      const text2 = c < row.length ? row[c] : "";
      const cell = { text: text2, colspan: 1, rowspan: 1, hidden: false, isHeader: true };
      gridRow.push(cell);
    }
    grid.push(gridRow);
  }
  for (const row of dataRows) {
    const gridRow = [];
    for (let c = 0; c < colCount; c++) {
      const text2 = c < row.length ? row[c] : "";
      const isHeader = verticalHeaderCols[c] || false;
      const cell = { text: text2, colspan: 1, rowspan: 1, hidden: false, isHeader };
      gridRow.push(cell);
    }
    grid.push(gridRow);
  }
  return { grid, alignments };
}
function applyMerges(grid) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.hidden)
        continue;
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
function stripMergeMarkers(grid) {
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.hidden) {
        const trimmed = cell.text.trim();
        if (trimmed === "<" || trimmed === "^") {
          cell.text = "";
        }
      }
    }
  }
}
function parseAndMerge(text) {
  const result = parseTable(text);
  applyMerges(result.grid);
  stripMergeMarkers(result.grid);
  return result;
}

// src/sheet/renderer.ts
var import_obsidian2 = require("obsidian");
function hasRowspanAcrossBoundary(grid, headerCount) {
  for (let r = 0; r < headerCount; r++) {
    for (const cell of grid[r]) {
      if (!cell.hidden && cell.rowspan > 1 && r + cell.rowspan > headerCount) {
        return true;
      }
    }
  }
  return false;
}
function renderTable(app, tableEl, parsed, sourcePath, component) {
  const { grid, alignments } = parsed;
  tableEl.empty();
  tableEl.id = "obsidian-sheets-parsed";
  tableEl.removeAttribute("data-resizable");
  if (grid.length === 0)
    return;
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
    const tbody = tableEl.createEl("tbody");
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      const tr = tbody.createEl("tr");
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (cell.hidden)
          continue;
        const tag = cell.isHeader ? "th" : "td";
        const el = tr.createEl(tag);
        if (alignments[c]) {
          el.style.textAlign = alignments[c] === "default" ? "left" : alignments[c];
        }
        if (cell.colspan > 1)
          el.colSpan = cell.colspan;
        if (cell.rowspan > 1)
          el.rowSpan = cell.rowspan;
        el.setAttribute("data-row", String(r));
        el.setAttribute("data-col", String(c));
        import_obsidian2.MarkdownRenderer.render(app, cell.text, el, sourcePath, component);
      }
    }
  } else {
    const headerRows = grid.slice(0, headerCount);
    const dataRows = grid.slice(headerCount);
    if (headerRows.length > 0) {
      const thead = tableEl.createEl("thead");
      for (const row of headerRows) {
        const tr = thead.createEl("tr");
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (cell.hidden)
            continue;
          const th = tr.createEl("th");
          if (alignments[c]) {
            th.style.textAlign = alignments[c] === "default" ? "left" : alignments[c];
          }
          if (cell.colspan > 1)
            th.colSpan = cell.colspan;
          if (cell.rowspan > 1)
            th.rowSpan = cell.rowspan;
          th.setAttribute("data-row", "0");
          th.setAttribute("data-col", String(c));
          import_obsidian2.MarkdownRenderer.render(app, cell.text, th, sourcePath, component);
        }
      }
    }
    if (dataRows.length > 0) {
      const tbody = tableEl.createEl("tbody");
      for (let r = 0; r < dataRows.length; r++) {
        const tr = tbody.createEl("tr");
        for (let c = 0; c < dataRows[r].length; c++) {
          const cell = dataRows[r][c];
          if (cell.hidden)
            continue;
          const tag = cell.isHeader ? "th" : "td";
          const td = tr.createEl(tag);
          if (alignments[c]) {
            td.style.textAlign = alignments[c] === "default" ? "left" : alignments[c];
          }
          if (cell.colspan > 1)
            td.colSpan = cell.colspan;
          if (cell.rowspan > 1)
            td.rowSpan = cell.rowspan;
          td.setAttribute("data-row", String(r + 1));
          td.setAttribute("data-col", String(c));
          import_obsidian2.MarkdownRenderer.render(app, cell.text, td, sourcePath, component);
        }
      }
    }
  }
}

// src/sheet/detect.ts
function hasMergeMarkers(text) {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.includes("|"))
      continue;
    if (/^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(trimmed))
      continue;
    const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
    const stripped = inner.endsWith("|") ? inner.slice(0, -1) : inner;
    const cells = stripped.split("|").map((c) => c.trim());
    for (const cell of cells) {
      if (cell === "<" || cell === "^") {
        return true;
      }
    }
  }
  return false;
}

// src/resizer/resizer.ts
function makeTableResizable(plugin, tableEl, onWidthsChanged) {
  var _a;
  if (tableEl.hasAttribute("data-resizable"))
    return;
  tableEl.setAttribute("data-resizable", "true");
  const settings = plugin.settings;
  const cols = Array.from(tableEl.querySelectorAll("colgroup col"));
  if (cols.length === 0)
    return;
  const cells = Array.from(tableEl.querySelectorAll("th, td"));
  for (const cell of cells) {
    const index = Number((_a = cell.getAttribute("data-col")) != null ? _a : cell.cellIndex);
    if (Number.isNaN(index) || index >= cols.length - 1)
      continue;
    cell.style.position = "relative";
    const handle = document.createElement("div");
    handle.className = "sheet-extend-resizer";
    cell.appendChild(handle);
    let startX = 0;
    let startWidth = 0;
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startWidth = cols[index].offsetWidth || cols[index].getBoundingClientRect().width;
      startX = e.clientX;
      tableEl.setAttribute("data-resizing", "true");
      document.body.classList.add("sheet-extend-resizing");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
    const onMouseMove = (e) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(
        settings.minWidth,
        Math.min(settings.maxWidth, startWidth + diff)
      );
      cols[index].style.width = newWidth + "px";
      cols[index].style.minWidth = newWidth + "px";
      cols[index].style.maxWidth = newWidth + "px";
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      tableEl.removeAttribute("data-resizing");
      document.body.classList.remove("sheet-extend-resizing");
      const widths = cols.map(
        (col) => col.style.width ? parseInt(col.style.width) : null
      );
      onWidthsChanged(widths);
    };
  }
}

// src/resizer/persistence.ts
function getTableId(tableEl) {
  const sourcePath = tableEl.getAttribute("data-source-path");
  const lineStart = tableEl.getAttribute("data-line-start");
  if (sourcePath && lineStart) {
    return `table-${sourcePath}-${lineStart}`;
  }
  const text = tableEl.textContent || "";
  const hash = text.slice(0, 100).replace(/\s+/g, " ").trim();
  return `table-fallback-${hash.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;
}
function saveWidths(plugin, tableId, widths) {
  const store = plugin.widthStore || {};
  const hasData = widths.some((w) => w !== null);
  if (hasData) {
    store[tableId] = widths;
  } else {
    delete store[tableId];
  }
  plugin.widthStore = store;
  plugin.saveData({
    version: "1.1.0",
    settings: plugin.settings,
    columnWidths: store
  });
}
function loadWidths(plugin, tableId) {
  const store = plugin.widthStore || {};
  return store[tableId] || null;
}
function applySavedWidths(tableEl, widths) {
  const cols = tableEl.querySelectorAll("colgroup col");
  for (let i = 0; i < cols.length && i < widths.length; i++) {
    const w = widths[i];
    if (w !== null) {
      const col = cols[i];
      col.style.width = w + "px";
      col.style.minWidth = w + "px";
      col.style.maxWidth = w + "px";
    }
  }
}

// main.ts
var SheetExtendPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.widthStore = {};
  }
  onload() {
    return __async(this, null, function* () {
      yield this.loadSettings();
      this.addSettingTab(new SheetExtendSettingTab(this.app, this));
      this.registerMarkdownPostProcessor((element, context) => {
        if (!this.settings.nativeProcessing)
          return;
        if (!this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView))
          return;
        const tables = Array.from(element.querySelectorAll("table:not([id='obsidian-sheets-parsed'])"));
        for (const tableEl of tables) {
          this.processTable(tableEl, context);
        }
      });
      this.registerMarkdownCodeBlockProcessor("sheet", (source, el, ctx) => {
        const parsed = parseAndMerge(source);
        const tableEl = el.createEl("table");
        renderTable(this.app, tableEl, parsed, ctx.sourcePath, this);
        this.setupResizer(tableEl);
      });
    });
  }
  processTable(tableEl, context) {
    var _a;
    const tableId = getTableId(tableEl);
    let sourceText = "";
    if (context.getSectionInfo) {
      const sectionInfo = context.getSectionInfo(tableEl);
      if (sectionInfo) {
        const lines = sectionInfo.text.split("\n");
        sourceText = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1).join("\n");
      }
    }
    if (!sourceText) {
      const view = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
      if (view && view.editor) {
        const fullDoc = view.editor.getValue();
        sourceText = this.findTableInSource(fullDoc, tableEl);
      }
    }
    if (!sourceText) {
      const rows = [];
      for (const tr of Array.from(tableEl.querySelectorAll("tr"))) {
        const cells = [];
        for (const td of Array.from(tr.querySelectorAll("th, td"))) {
          cells.push(td.innerHTML || "");
        }
        rows.push("| " + cells.join(" | ") + " |");
      }
      sourceText = rows.join("\n");
      if (rows.length > 1) {
        const colCount = ((_a = tableEl.querySelector("tr")) == null ? void 0 : _a.children.length) || 1;
        const delim = "| " + Array(colCount).fill("---").join(" | ") + " |";
        sourceText = rows[0] + "\n" + delim + "\n" + rows.slice(1).join("\n");
      }
    }
    if (!hasMergeMarkers(sourceText)) {
      const savedWidths2 = loadWidths(this, tableId);
      if (savedWidths2) {
        applySavedWidths(tableEl, savedWidths2);
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
  findTableInSource(fullDoc, tableEl) {
    var _a;
    const lines = fullDoc.split("\n");
    const headerRow = tableEl.querySelector("tr");
    if (!headerRow)
      return "";
    const headerCells = [];
    for (const th of Array.from(headerRow.querySelectorAll("th, td"))) {
      const text = ((_a = th.textContent) == null ? void 0 : _a.trim()) || "";
      if (text)
        headerCells.push(text);
    }
    if (headerCells.length === 0)
      return "";
    let tableStartIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("|"))
        continue;
      const allMatch = headerCells.every((cell) => line.includes(cell));
      if (allMatch) {
        tableStartIdx = i;
        break;
      }
    }
    if (tableStartIdx < 0)
      return "";
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
  setupResizer(tableEl) {
    const tableId = getTableId(tableEl);
    makeTableResizable(this, tableEl, (widths) => {
      saveWidths(this, tableId, widths);
    });
  }
  onunload() {
    document.body.classList.remove("sheet-extend-resizing");
  }
  loadSettings() {
    return __async(this, null, function* () {
      const data = yield this.loadData();
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data == null ? void 0 : data.settings);
      const savedVersion = (data == null ? void 0 : data.version) || "0.0.0";
      if (savedVersion !== "1.3.0") {
        this.widthStore = {};
        yield this.saveData({
          version: "1.3.0",
          settings: this.settings,
          columnWidths: {}
        });
      } else {
        this.widthStore = (data == null ? void 0 : data.columnWidths) || {};
      }
    });
  }
  saveSettings() {
    return __async(this, null, function* () {
      yield this.saveData({
        version: "1.3.0",
        settings: this.settings,
        columnWidths: this.widthStore
      });
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
