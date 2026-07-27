# Sheet Extend

Sheet Extend is an Obsidian plugin that enhances markdown tables with resizable columns and cell merging, working seamlessly across Reading mode and Live Preview.

## Features

- Drag to resize table columns in Reading mode and Live Preview.
- Column widths sync automatically between open panes and tabs.
- Merge cells horizontally and vertically with right-click or hotkeys.
- Store widths in plugin data or inline in markdown separator rows.
- Native table processing — works on all markdown tables, no code block required.
- `sheet` fenced code blocks for dedicated enhanced tables.

## Installation

### BRAT

1. Install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).
2. Add `Neptune-Illusion/sheet-extend` to BRAT.
3. Enable **Sheet Extend** in Community Plugins.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Neptune-Illusion/sheet-extend/releases).
2. Copy them into `.obsidian/plugins/sheet-extend/`.
3. Enable **Sheet Extend** in Community Plugins.

## Usage

### Column Resizing

Hover over a column border and drag the handle. Widths persist across sessions.

When `Store column widths in Markdown` is enabled, widths are written into the table separator row using dash counts:

```
|---|       default
|:---|      left-aligned
|---:|      right-aligned
|:---:|     center-aligned
```

### Cell Merging

Sheet Extend uses hidden HTML comment markers (`<!-- sheet-extend:merge-left -->`, `<!-- sheet-extend:merge-up -->`) for new merges. Legacy `<` (merge left) and `^` (merge up) syntax is still supported for existing documents.

**Interactive merging:**
- Click a cell, then Shift+click another to select a range.
- Right-click → Merge horizontally / vertically / Unmerge.
- `Mod+Shift+Right` — merge horizontally.
- `Mod+Shift+Down` — merge vertically.
- `Mod+Shift+Left` — unmerge.

### Sheet Blocks

```markdown
` ``sheet
| Header 1 | Header 2 |
|----------|----------|
| Cell A   | Cell B   |
` ``
```

Sheet blocks support all merge features.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Minimum column width | 50px | Lower bound for resized columns |
| Maximum column width | 500px | Upper bound for resized columns |
| Default column width | 150px | Default width when a column is resized |
| Enable native table processing | On | Process all markdown tables, not just `sheet` blocks |
| Store column widths in Markdown | Off | Write widths into separator row dash counts |
| Pixels per separator dash | 8px | Used when storing widths in Markdown |

## Notes

- Width sync works across open Reading mode and Live Preview panes for the same file.
- Existing documents using `<` and `^` merge markers continue to work unchanged.
- New merge operations use hidden HTML comments to keep your markdown clean.
