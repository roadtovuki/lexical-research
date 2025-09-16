import { ElementNode } from './LexicalElementNode';

export class RootNode extends ElementNode {}

export function $createRootNode(): RootNode {
  return new RootNode();
}
