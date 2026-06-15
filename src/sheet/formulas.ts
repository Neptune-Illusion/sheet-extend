import type { ParsedTable } from "./parser";

type FormulaName = "sum" | "avg" | "count" | "max" | "min";

function parseFormula(text: string): FormulaName | null {
  const match = text.trim().toLowerCase().match(/^=(sum|avg|count|max|min)$/);
  return match ? (match[1] as FormulaName) : null;
}

function parseNumber(text: string): number | null {
  const normalized = text.replace(/,/g, "").trim();
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4)));
}

function calculateFormula(name: FormulaName, values: number[]): string {
  if (name === "count") return String(values.length);
  if (!values.length) return "";

  if (name === "sum") return formatNumber(values.reduce((sum, value) => sum + value, 0));
  if (name === "avg") return formatNumber(values.reduce((sum, value) => sum + value, 0) / values.length);
  if (name === "max") return formatNumber(Math.max(...values));
  return formatNumber(Math.min(...values));
}

export function applyFormulas(parsed: ParsedTable): ParsedTable {
  const grid = parsed.grid.map((row) => row.map((cell) => ({ ...cell })));
  const originalGrid = parsed.grid;

  for (let row = 1; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      if (cell.hidden) continue;

      const formula = parseFormula(cell.text);
      if (!formula) continue;

      const values: number[] = [];
      for (let sourceRow = 1; sourceRow < row; sourceRow++) {
        const sourceCell = originalGrid[sourceRow]?.[col];
        if (!sourceCell || sourceCell.hidden) continue;
        if (parseFormula(sourceCell.text)) continue;
        const value = parseNumber(sourceCell.text);
        if (value !== null) values.push(value);
      }
      cell.text = calculateFormula(formula, values);
    }
  }

  return {
    ...parsed,
    grid,
  };
}
