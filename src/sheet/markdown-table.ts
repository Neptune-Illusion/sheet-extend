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
  rawSeparatorLine: string;
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
  const lines = markdown.split("\n");
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
      text: tableLines.join("\n"),
      range: { startLine: headerLine, endLine },
      tableOrdinal: specs.length,
      headerCells: splitMarkdownRow(lines[headerLine]),
      bodyLines,
      columns,
      rawSeparatorLine: lines[separatorLine],
    });
    separatorLine = endLine;
  }

  return specs;
}

function normalizeSignatureCell(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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

export function updateSeparatorLineForWidths(
  documentText: string,
  range: TableRange,
  widths: (number | null)[],
  pixelsPerDash: number
): string | null {
  const lines = documentText.split("\n");
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
  return lines.join("\n");
}
