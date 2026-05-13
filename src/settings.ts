import { PluginSettingTab, Setting, App, Plugin } from "obsidian";

export interface SheetExtendSettings {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  nativeProcessing: boolean;
}

export const DEFAULT_SETTINGS: SheetExtendSettings = {
  minWidth: 50,
  maxWidth: 500,
  defaultWidth: 150,
  nativeProcessing: true,
};

export class SheetExtendSettingTab extends PluginSettingTab {
  plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    super(app, plugin);
    this.plugin = plugin;
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
          .setValue((this.plugin as any).settings.minWidth)
          .onChange(async (value) => {
            (this.plugin as any).settings.minWidth = value;
            await (this.plugin as any).saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Maximum column width")
      .setDesc("Maximum width for a resized column (px)")
      .addSlider((slider) =>
        slider
          .setLimits(200, 800, 10)
          .setValue((this.plugin as any).settings.maxWidth)
          .onChange(async (value) => {
            (this.plugin as any).settings.maxWidth = value;
            await (this.plugin as any).saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default column width")
      .setDesc("Default column width when resized (px)")
      .addSlider((slider) =>
        slider
          .setLimits(80, 300, 5)
          .setValue((this.plugin as any).settings.defaultWidth)
          .onChange(async (value) => {
            (this.plugin as any).settings.defaultWidth = value;
            await (this.plugin as any).saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable native table processing")
      .setDesc("Automatically process all markdown tables (not just sheet code blocks)")
      .addToggle((toggle) =>
        toggle
          .setValue((this.plugin as any).settings.nativeProcessing)
          .onChange(async (value) => {
            (this.plugin as any).settings.nativeProcessing = value;
            await (this.plugin as any).saveSettings();
          })
      );
  }
}
