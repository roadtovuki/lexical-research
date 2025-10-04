import { KlassConstructor } from '../LexicalEditor';
import { LexicalNode, NodeKey } from '../LexicalNode';

/** @noInheritDoc */
export class ElementNode extends LexicalNode {
  /** @internal */
  declare ['constructor']: KlassConstructor<typeof ElementNode>;
  /** @internal */
  __first: null | NodeKey;
  /** @internal */
  __last: null | NodeKey;
  /** @internal */
  __size: number;
  /** @internal */
  __format: number;
  /** @internal */
  __style: string;
  /** @internal */
  __indent: number;
  /** @internal */
  __dir: 'ltr' | 'rtl' | null;
  /** @internal */
  __textFormat: number;
  /** @internal */
  __textStyle: string;

  constructor(key?: NodeKey) {
    super(key);
    this.__first = null;
    this.__last = null;
    this.__size = 0;
    this.__format = 0;
    this.__style = '';
    this.__indent = 0;
    this.__dir = null;
    this.__textFormat = 0;
    this.__textStyle = '';
  }
}

export function $isElementNode(
  node: LexicalNode | null | undefined,
): node is ElementNode {
  return node instanceof ElementNode;
}
