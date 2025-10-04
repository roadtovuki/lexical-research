import { KlassConstructor } from '../LexicalEditor';
import { LexicalNode } from '../LexicalNode';

/** @noInheritDoc */
export class DecoratorNode<T> extends LexicalNode {
  /** @internal */
  declare ['constructor']: KlassConstructor<typeof DecoratorNode<T>>;
}
