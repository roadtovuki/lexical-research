import { ElementNode } from './LexicalElementNode';

/** @noInheritDoc */
export class RootNode extends ElementNode {
  /** @internal */
  __cachedText: null | string;

  static getType(): string {
    return 'root';
  }

  static clone(): RootNode {
    return new RootNode();
  }

  // TODO: Implement static importJSON method

  constructor() {
    super('root');
    this.__cachedText = null;
  }
}

export function $createRootNode(): RootNode {
  return new RootNode();
}
