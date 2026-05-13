# Sheet Extend

Combines column resizing + advanced table features (cell merging, headers, sheet blocks) into one Obsidian plugin.

## Features

- **Column resizing** — drag column borders to resize in reading mode
- **Cell merging** — `^` merges up, `<` merges left
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

### Cell Merging
In a markdown table:
- Put `^` in a cell to merge it with the cell above
- Put `<` in a cell to merge it with the cell to the left

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
- Native table processing toggle
