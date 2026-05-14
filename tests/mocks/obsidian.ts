export class Component {
  load(): void {}
  unload(): void {}
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

export type App = any;
