import { PluginSettingTab, Setting, App, Plugin } from "obsidian";

export interface SheetExtendSettings {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  nativeProcessing: boolean;
  widthPersistence: "plugin" | "markdown";
  pixelsPerDash: number;
  enableFormulas: boolean;
}

export const DEFAULT_SETTINGS: SheetExtendSettings = {
  minWidth: 50,
  maxWidth: 500,
  defaultWidth: 150,
  nativeProcessing: true,
  widthPersistence: "plugin",
  pixelsPerDash: 8,
  enableFormulas: true,
};

export class SheetExtendSettingTab extends PluginSettingTab {
  plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  get settings(): SheetExtendSettings {
    return (this.plugin as any).settings;
  }

  async updateSettings(changes: Partial<SheetExtendSettings>) {
    Object.assign((this.plugin as any).settings, changes);
    await (this.plugin as any).saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Sheet Extend Settings" });

    new Setting(containerEl)
      .setName("Minimum column width")
      .setDesc("Minimum width for a resized column (px)")
      .addSlider((slider) =>
        slider
          .setLimits(30, 100, 5)
          .setValue(this.settings.minWidth)
          .onChange(async (value) => {
            await this.updateSettings({ minWidth: value });
          })
      );

    new Setting(containerEl)
      .setName("Maximum column width")
      .setDesc("Maximum width for a resized column (px)")
      .addSlider((slider) =>
        slider
          .setLimits(200, 800, 10)
          .setValue(this.settings.maxWidth)
          .onChange(async (value) => {
            await this.updateSettings({ maxWidth: value });
          })
      );

    new Setting(containerEl)
      .setName("Default column width")
      .setDesc("Default column width when resized (px)")
      .addSlider((slider) =>
        slider
          .setLimits(80, 300, 5)
          .setValue(this.settings.defaultWidth)
          .onChange(async (value) => {
            await this.updateSettings({ defaultWidth: value });
          })
      );

    new Setting(containerEl)
      .setName("Enable native table processing")
      .setDesc("Automatically process all markdown tables (not just sheet code blocks)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.nativeProcessing)
          .onChange(async (value) => {
            await this.updateSettings({ nativeProcessing: value });
          })
      );

    new Setting(containerEl)
      .setName("Store column widths in Markdown")
      .setDesc("Write resized column widths into the table separator row using dash counts")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.widthPersistence === "markdown")
          .onChange(async (value) => {
            await this.updateSettings({ widthPersistence: value ? "markdown" : "plugin" });
          })
      );

    new Setting(containerEl)
      .setName("Pixels per separator dash")
      .setDesc("Used when storing column widths in Markdown")
      .addSlider((slider) =>
        slider
          .setLimits(4, 20, 1)
          .setValue(this.settings.pixelsPerDash)
          .onChange(async (value) => {
            await this.updateSettings({ pixelsPerDash: value });
          })
      );

    new Setting(containerEl)
      .setName("Enable table formulas")
      .setDesc("Render =sum, =avg, =count, =max, and =min in enhanced tables")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.enableFormulas)
          .onChange(async (value) => {
            await this.updateSettings({ enableFormulas: value });
          })
      );
  }
}
