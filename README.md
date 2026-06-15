# Sheet Extend

Combines column resizing + advanced table features (cell merging, headers, sheet blocks) into one Obsidian plugin.

## Features

- **Column resizing** — drag column borders to resize in reading mode
- **Cell merging** — `^` merges up, `<` merges left
- **Live Preview support** — resize and merge enhanced tables while editing
- **Markdown width persistence** — optionally store resized widths in separator dash counts
- **Table formulas** — render `=sum`, `=avg`, `=count`, `=max`, and `=min`
- **Headers** — `---` row/column creates headers
- **Sheet code blocks** — use ` ```sheet ` fenced blocks
- **Native table processing** — automatically enhances all markdown tables

## Installation

### BRAT
1. Install the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat)
2. Add `Neptune-Illusion/sheet-extend` to BRAT's beta plugin list
3. Enable "Sheet Extend" in Community Plugins

### Manual
1. Download the latest release from GitHub
2. Extract to `.obsidian/plugins/sheet-extend/`
3. Enable in Community Plugins

## Usage

### Column Resizing
Hover over any column border in reading mode and drag to resize.

By default widths are saved in plugin data. Enable **Store column widths in Markdown** to encode widths in the table separator row by changing the number of `-` characters while preserving `:---`, `:---:`, and `---:` alignment.

### Cell Merging
In a markdown table:
- Put `^` in a cell to merge it with the cell above
- Put `<` in a cell to merge it with the cell to the left
- Select cells in an enhanced table, then use the right-click menu or hotkeys:
  - Horizontal merge: `Mod+Shift+Right`
  - Vertical merge: `Mod+Shift+Down`
  - Unmerge: `Mod+Shift+Left`

### Formulas
In enhanced tables, put a formula in a column cell to render a value from the numeric cells above it:

- `=sum`
- `=avg`
- `=count`
- `=max`
- `=min`

### Sheet Blocks

```sheet
| Header 1 | Header 2 |
|----------|----------|
| Cell A   | Cell B   |
```

## Settings

- Minimum column width
- Maximum column width
- Default column width
- Store column widths in Markdown
- Pixels per separator dash
- Enable table formulas
- Native table processing toggle
