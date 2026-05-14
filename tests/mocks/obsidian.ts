export class Component {
  load(): void {}
  unload(): void {}
}

export class Plugin {
  app: any;
  manifest: any;

  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  loadSettings(): Promise<void> { return Promise.resolve(); }
  saveSettings(): Promise<void> { return Promise.resolve(); }
  loadData(): Promise<any> { return Promise.resolve({}); }
  saveData(_data: any): Promise<void> { return Promise.resolve(); }
  addSettingTab(_tab: any): void {}
  registerMarkdownPostProcessor(_processor: any): void {}
  registerMarkdownCodeBlockProcessor(_lang: string, _processor: any): void {}
}

export class PluginSettingTab {
  app: any;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: any, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }

  display(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  addSlider(_cb: (slider: any) => void): this { return this; }
  addToggle(_cb: (toggle: any) => void): this { return this; }
}

export class MarkdownRenderer {
  static render(
    _app: any,
    text: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: Component
  ): void {
    el.textContent = text;
  }
}

export class MarkdownRenderChild extends Component {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    super();
    this.containerEl = containerEl;
  }
}

export type App = any;
