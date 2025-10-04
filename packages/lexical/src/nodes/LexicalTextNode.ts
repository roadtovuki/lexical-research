import { KlassConstructor } from '../LexicalEditor';
import { LexicalNode, NodeKey } from '../LexicalNode';

/** @noInheritDoc */
export class TextNode extends LexicalNode {
  /** @internal */
  declare ['constructor']: KlassConstructor<typeof TextNode>;
  __text: string;
  /** @internal */
  __format: number;
  /** @internal */
  __style: string;
  /** @internal */
  __mode: 0 | 1 | 2 | 3;
  /** @internal */
  __detail: number;

  static getType(): string {
    return 'text';
  }

  static clone(node: TextNode): TextNode {
    return new TextNode(node.__text, node.__key);
  }

  constructor(text: string = '', key?: NodeKey) {
    super(key);
    this.__text = text;
    this.__format = 0;
    this.__style = '';
    this.__mode = 0;
    this.__detail = 0;
  }
}
