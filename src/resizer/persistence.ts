import { Plugin } from "obsidian";

export const DATA_VERSION = "1.5.0";

export function getTableId(tableEl: HTMLTableElement): string {
  return getTableIds(tableEl)[0];
}

export function getTableIds(tableEl: HTMLTableElement): string[] {
  const sourcePath = tableEl.getAttribute("data-source-path");
  const lineStart = tableEl.getAttribute("data-line-start");
  const ordinal = tableEl.dataset.sheetExtendTableOrdinal;
  const ids: string[] = [];

  if (sourcePath && lineStart) {
    ids.push(`table-${sourcePath}-${lineStart}`);
  }
  if (sourcePath && ordinal) {
    ids.push(`table-${sourcePath}-ordinal-${ordinal}`);
  }

  // ponytail: stable fallback; skip textContent hash to avoid losing widths on cell edits
  if (sourcePath && Number.isInteger(Number(ordinal))) {
    ids.push(`table-${sourcePath}-ordinal-${ordinal}-fallback`);
  }

  return Array.from(new Set(ids));
}

export interface WidthStore {
  [tableId: string]: (number | null)[];
}

export function saveWidths(
  plugin: Plugin,
  tableId: string | string[],
  widths: (number | null)[]
): void {
  const store: WidthStore = (plugin as any).widthStore || {};
  const tableIds = Array.isArray(tableId) ? tableId : [tableId];
  const hasData = widths.some((w) => w !== null);
  for (const id of tableIds) {
    if (hasData) {
      store[id] = widths;
    } else {
      delete store[id];
    }
  }
  (plugin as any).widthStore = store;
  plugin.saveData({
    version: DATA_VERSION,
    settings: (plugin as any).settings,
    columnWidths: store,
  });
}

export function loadWidths(
  plugin: Plugin,
  tableId: string | string[]
): (number | null)[] | null {
  const store: WidthStore = (plugin as any).widthStore || {};
  const tableIds = Array.isArray(tableId) ? tableId : [tableId];
  for (const id of tableIds) {
    if (store[id]) {
      return store[id];
    }
  }
  return null;
}

export function applySavedWidths(
  tableEl: HTMLTableElement,
  widths: (number | null)[]
): void {
  const cols = tableEl.querySelectorAll("colgroup col");
  for (let i = 0; i < cols.length && i < widths.length; i++) {
    const w = widths[i];
    if (w !== null) {
      const col = cols[i] as HTMLElement;
      col.style.width = w + "px";
      col.style.minWidth = w + "px";
      col.style.maxWidth = w + "px";
    }
  }
}
