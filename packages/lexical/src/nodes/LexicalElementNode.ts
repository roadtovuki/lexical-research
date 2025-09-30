import { LexicalNode } from '../LexicalNode';

export class ElementNode extends LexicalNode {}

export function $isElementNode(
  node: LexicalNode | null | undefined,
): node is ElementNode {
  return node instanceof ElementNode;
}
