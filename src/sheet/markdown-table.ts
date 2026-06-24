import type { TableRange } from "./writeback";

export interface MarkdownTableColumn {
  alignLeft: boolean;
  alignRight: boolean;
  dashCount: number;
}

export interface MarkdownTableSpec {
  text: string;
  range: TableRange;
  tableOrdinal: number;
  headerCells: string[];
  bodyLines: string[];
  columns: MarkdownTableColumn[];
  rawHeaderLine: string;
  rawSeparatorLine: string;
}

export function getLineEnding(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function splitMarkdownLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function isMarkdownTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

export function splitMarkdownRow(line: string): string[] {
  if (!line.includes("|")) return [];
  let normalized = line.trim();
  if (normalized.startsWith("|")) normalized = normalized.slice(1);
  if (normalized.endsWith("|")) normalized = normalized.slice(0, -1);
  return normalized.split("|").map((cell) => cell.trim());
}

export function parseSeparatorLine(line: string): MarkdownTableColumn[] | null {
  const cells = splitMarkdownRow(line);
  if (!cells.length) return null;

  const columns: MarkdownTableColumn[] = [];
  for (const cell of cells) {
    const match = cell.match(/^(:)?(-{3,})(:)?$/);
    if (!match) return null;
    columns.push({
      alignLeft: !!match[1],
      alignRight: !!match[3],
      dashCount: match[2].length,
    });
  }
  return columns;
}

export function buildSeparatorLine(columns: MarkdownTableColumn[], dashCounts: number[]): string {
  return `| ${dashCounts
    .map((dashCount, index) => {
      const column = columns[index] || { alignLeft: false, alignRight: false, dashCount: 3 };
      const dashes = "-".repeat(Math.max(3, dashCount));
      return `${column.alignLeft ? ":" : ""}${dashes}${column.alignRight ? ":" : ""}`;
    })
    .join(" | ")} |`;
}

export function extractMarkdownTableSpecs(markdown: string): MarkdownTableSpec[] {
  const lines = splitMarkdownLines(markdown);
  const lineEnding = getLineEnding(markdown);
  const specs: MarkdownTableSpec[] = [];

  for (let separatorLine = 1; separatorLine < lines.length; separatorLine++) {
    const columns = parseSeparatorLine(lines[separatorLine]);
    if (!columns) continue;
    if (!isMarkdownTableLine(lines[separatorLine - 1])) continue;

    const headerLine = separatorLine - 1;
    const bodyLines: string[] = [];
    let endLine = separatorLine;
    for (let line = separatorLine + 1; line < lines.length; line++) {
      if (!isMarkdownTableLine(lines[line])) break;
      bodyLines.push(lines[line]);
      endLine = line;
    }

    const tableLines = lines.slice(headerLine, endLine + 1);
    specs.push({
      text: tableLines.join(lineEnding),
      range: { startLine: headerLine, endLine },
      tableOrdinal: specs.length,
      headerCells: splitMarkdownRow(lines[headerLine]),
      bodyLines,
      columns,
      rawHeaderLine: lines[headerLine],
      rawSeparatorLine: lines[separatorLine],
    });
    separatorLine = endLine;
  }

  return specs;
}

export function normalizeSignatureCell(text: unknown): string {
  return String(text || "")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function markdownTableSignature(spec: MarkdownTableSpec): string {
  return [spec.headerCells, ...spec.bodyLines.map(splitMarkdownRow)]
    .map((row) => row.map(normalizeSignatureCell).join("|"))
    .join("\n");
}

export function domTableSignature(tableEl: HTMLTableElement): string {
  return Array.from(tableEl.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => normalizeSignatureCell(cell.textContent || ""))
        .join("|")
    )
    .join("\n");
}

function uniqueSpecBySignature(
  specs: MarkdownTableSpec[],
  signature: string | null,
  buildSpecSignature: (spec: MarkdownTableSpec) => string | null
): MarkdownTableSpec | null {
  if (!signature) return null;
  const matches = specs.filter((spec) => buildSpecSignature(spec) === signature);
  return matches.length === 1 ? matches[0] : null;
}

export function domTableHeaderSignature(tableEl: HTMLTableElement): string | null {
  const headerRow = tableEl.rows?.[0];
  return headerRow?.cells.length
    ? Array.from(headerRow.cells).map((cell) => normalizeSignatureCell(cell.textContent)).join("|")
    : null;
}

export function markdownTableHeaderSignature(spec: MarkdownTableSpec): string | null {
  return spec.headerCells.length
    ? spec.headerCells.map((cell) => normalizeSignatureCell(cell)).join("|")
    : null;
}

export function domTableBodySignature(tableEl: HTMLTableElement): string | null {
  if (!(tableEl instanceof HTMLTableElement) || tableEl.rows.length < 2) return null;
  return Array.from(tableEl.rows)
    .slice(1)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => normalizeSignatureCell(cell.textContent))
        .join("|")
    )
    .join("\n");
}

export function markdownTableBodySignature(spec: MarkdownTableSpec): string | null {
  return spec.bodyLines.length
    ? spec.bodyLines
        .map((line) => splitMarkdownRow(line).map((cell) => normalizeSignatureCell(cell)).join("|"))
        .join("\n")
    : null;
}

export function domTableContentSignature(tableEl: HTMLTableElement): string | null {
  if (!(tableEl instanceof HTMLTableElement) || !tableEl.rows.length) return null;

  const rows = Array.from(tableEl.rows).map((row) =>
    Array.from(row.cells).map((cell) => normalizeSignatureCell(cell.textContent))
  );
  if (!rows.length || !rows[0].length) return null;

  const previewBody = rows
    .slice(1, 3)
    .map((row) => row.join("|"))
    .join("\n");
  return [rows.length, rows[0].length, rows[0].join("|"), previewBody].join("\u001f");
}

export function markdownTableContentSignature(spec: MarkdownTableSpec): string | null {
  if (!spec.headerCells.length) return null;

  const previewBody = spec.bodyLines
    .slice(0, 2)
    .map((line) => splitMarkdownRow(line).map((cell) => normalizeSignatureCell(cell)).join("|"))
    .join("\n");
  return [
    1 + spec.bodyLines.length,
    spec.headerCells.length,
    spec.headerCells.map((cell) => normalizeSignatureCell(cell)).join("|"),
    previewBody,
  ].join("\u001f");
}

export function matchMarkdownTableSpecForElement(
  specs: MarkdownTableSpec[],
  tableEl: HTMLTableElement,
  sourceLine: number | null = null
): MarkdownTableSpec | null {
  if (!specs.length || !(tableEl instanceof HTMLTableElement)) return null;
  if (specs.length === 1) return specs[0];

  if (Number.isInteger(sourceLine) && sourceLine !== null) {
    const containing = specs.find(
      (spec) => sourceLine >= spec.range.startLine && sourceLine <= spec.range.endLine
    );
    if (containing) return containing;
  }

  const ordinal = Number.parseInt(tableEl.dataset.sheetExtendTableOrdinal ?? "", 10);
  if (Number.isInteger(ordinal) && ordinal >= 0 && specs[ordinal]) {
    return specs[ordinal];
  }

  const lineStart = Number.parseInt(tableEl.getAttribute("data-line-start") ?? "", 10);
  if (Number.isInteger(lineStart)) {
    const lineMatch = specs.find((spec) => spec.range.startLine === lineStart);
    if (lineMatch) return lineMatch;
  }

  const contentMatch = uniqueSpecBySignature(
    specs,
    domTableContentSignature(tableEl),
    markdownTableContentSignature
  );
  if (contentMatch) return contentMatch;

  const bodyMatch = uniqueSpecBySignature(
    specs,
    domTableBodySignature(tableEl),
    markdownTableBodySignature
  );
  if (bodyMatch) return bodyMatch;

  const headerMatch = uniqueSpecBySignature(
    specs,
    domTableHeaderSignature(tableEl),
    markdownTableHeaderSignature
  );
  if (headerMatch) return headerMatch;

  const exactMatch = uniqueSpecBySignature(
    specs,
    domTableSignature(tableEl),
    markdownTableSignature
  );
  if (exactMatch) return exactMatch;

  return null;
}

export function updateSeparatorLineForWidths(
  documentText: string,
  range: TableRange,
  widths: (number | null)[],
  pixelsPerDash: number
): string | null {
  const lines = splitMarkdownLines(documentText);
  const lineEnding = getLineEnding(documentText);
  const separatorLineIndex = range.startLine + 1;
  const separatorLine = lines[separatorLineIndex];
  const columns = parseSeparatorLine(separatorLine);
  if (!columns) return null;

  const dashCounts = columns.map((column, index) => {
    const width = widths[index];
    if (typeof width !== "number" || Number.isNaN(width)) return column.dashCount;
    return Math.max(3, Math.round(width / pixelsPerDash));
  });

  lines[separatorLineIndex] = buildSeparatorLine(columns, dashCounts);
  return lines.join(lineEnding);
}

export function buildSeparatorLineForWidths(
  separatorLine: string,
  widths: (number | null)[],
  pixelsPerDash: number
): string | null {
  const columns = parseSeparatorLine(separatorLine);
  if (!columns) return null;

  const dashCounts = columns.map((column, index) => {
    const width = widths[index];
    if (typeof width !== "number" || Number.isNaN(width)) return column.dashCount;
    return Math.max(3, Math.round(width / pixelsPerDash));
  });

  return buildSeparatorLine(columns, dashCounts);
}
