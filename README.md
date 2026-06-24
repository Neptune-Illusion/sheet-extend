# sheet extend

sheet extend is an Obsidian plugin for working with markdown tables directly in Reading mode and Live Preview.

It adds resizable columns, cell merging, optional markdown-based width persistence, formulas, and enhanced rendering for normal markdown tables and `sheet` code blocks.

## Features

- Resize table columns by dragging column borders.
- Sync resized widths between Reading mode and Live Preview.
- Merge cells horizontally and vertically.
- Keep legacy `<` and `^` merge syntax readable while writing new merge markers as hidden comments.
- Store widths in plugin data, or optionally encode widths in the markdown separator row.
- Render table formulas: `=sum`, `=avg`, `=count`, `=max`, and `=min`.
- Enhance normal markdown tables without requiring a fenced code block.
- Render dedicated `sheet` fenced code blocks.

## Installation

### BRAT

1. Install the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat).
2. Add `Neptune-Illusion/sheet-extend` to BRAT.
3. Enable `sheet extend` in Community Plugins.

### Manual

1. Download the latest release from GitHub.
2. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/sheet-extend/`.
3. Enable `sheet extend` in Community Plugins.

## Usage

### Column Resizing

Hover over a table column border and drag the handle.

Widths are saved in plugin data by default. If `Store column widths in Markdown` is enabled, sheet extend writes widths into the table separator row by changing dash counts while preserving markdown alignment:

- `---`
- `:---`
- `---:`
- `:---:`

### Cell Merging

sheet extend supports legacy merge markers:

- `<` merges the cell with the visible cell on its left.
- `^` merges the cell with the visible cell above it.

New merge operations write hidden markdown comments instead of visible markers, so merged helper cells do not appear in Reading mode or Live Preview.

You can also select cells in an enhanced table and use:

- Right-click menu: merge horizontally, merge vertically, or unmerge.
- `Mod+Shift+Right`: merge horizontally.
- `Mod+Shift+Down`: merge vertically.
- `Mod+Shift+Left`: unmerge.

### Formulas

Put a formula in a table cell to calculate from numeric cells above it:

- `=sum`
- `=avg`
- `=count`
- `=max`
- `=min`

### Sheet Blocks

````markdown
```sheet
| Header 1 | Header 2 |
|----------|----------|
| Cell A   | Cell B   |
```
````

## Settings

- `Minimum column width`
- `Maximum column width`
- `Default column width`
- `Enable native table processing`
- `Store column widths in Markdown`
- `Pixels per separator dash`
- `Enable table formulas`

## Notes

- Width sync works across open Reading mode and Live Preview panes for the same file.
- Existing documents that use `<` and `^` continue to work.
- New merge operations use hidden comments to avoid visible marker artifacts.
