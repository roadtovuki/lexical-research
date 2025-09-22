import { PROTOTYPE_CONFIG_METHOD } from './LexicalConstants';
import { Klass, LexicalEditor, RegisteredNode } from './LexicalEditor';
import { LexicalNode, StaticNodeConfigValue } from './LexicalNode';
import { DecoratorNode } from './nodes/LexicalDecoratorNode';
import { ElementNode } from './nodes/LexicalElementNode';
import invariant from 'shared/invariant';
import { TextNode } from './nodes/LexicalTextNode';

let pendingNodeToClone: null | LexicalNode = null;
export function setPendingNodeToClone(pendingNode: null | LexicalNode): void {
  pendingNodeToClone = pendingNode;
}

function hasOwn(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

export function hasOwnStaticMethod(
  klass: Klass<LexicalNode>,
  k: keyof Klass<LexicalNode>,
): boolean {
  return hasOwn(klass, k) && klass[k] !== LexicalNode[k];
}

function isAbstractNodeClass(klass: Klass<LexicalNode>): boolean {
  return (
    klass === DecoratorNode || klass === ElementNode || klass === LexicalNode
  );
}

export function getStaticNodeConfig(klass: Klass<LexicalNode>): {
  ownNodeType: undefined | string;
  ownNodeConfig: undefined | StaticNodeConfigValue<LexicalNode, string>;
} {
  const nodeConfigRecord =
    PROTOTYPE_CONFIG_METHOD in klass.prototype
      ? klass.prototype[PROTOTYPE_CONFIG_METHOD]()
      : undefined;
  const isAbstract = isAbstractNodeClass(klass);
  const nodeType =
    !isAbstract && hasOwnStaticMethod(klass, 'getType')
      ? klass.getType()
      : undefined;
  let ownNodeConfig: undefined | StaticNodeConfigValue<LexicalNode, string>;
  let ownNodeType = nodeType;
  if (nodeConfigRecord) {
    if (nodeType) {
      ownNodeConfig = nodeConfigRecord[nodeType];
    } else {
      for (const [k, v] of Object.entries(nodeConfigRecord)) {
        ownNodeType = k;
        ownNodeConfig = v;
      }
    }
  }
  if (!isAbstract && ownNodeType) {
    if (!hasOwnStaticMethod(klass, 'getType')) {
      klass.getType = () => ownNodeType;
    }
    if (!hasOwnStaticMethod(klass, 'clone')) {
      // TextNode.length > 0 will only be true if the compiler output
      // is not ES6 compliant, in which case we can not provide this
      // warning
      if (__DEV__ && TextNode.length === 0) {
        invariant(
          klass.length === 0,
          '%s (type %s) must implement a static clone method since its constructor has %s required arguments (expecting 0). Use an explicit default in the first argument of your constructor(prop: T=X, nodeKey?: NodeKey).',
          klass.name,
          ownNodeType,
          String(klass.length),
        );
      }
      klass.clone = (prevNode: LexicalNode) => {
        setPendingNodeToClone(prevNode);
        return new klass();
      };
    }
    if (!hasOwnStaticMethod(klass, 'importJSON')) {
      if (__DEV__ && TextNode.length === 0) {
        invariant(
          klass.length === 0,
          '%s (type %s) must implement a static importJSON method since its constructor has %s required arguments (expecting 0). Use an explicit default in the first argument of your constructor(prop: T=X, nodeKey?: NodeKey).',
          klass.name,
          ownNodeType,
          String(klass.length),
        );
      }
      klass.importJSON =
        (ownNodeConfig && ownNodeConfig.$importJSON) ||
        ((serializedNode) => new klass().updateFromJSON(serializedNode));
    }
    if (!hasOwnStaticMethod(klass, 'importDOM') && ownNodeConfig) {
      const { importDOM } = ownNodeConfig;
      if (importDOM) {
        klass.importDOM = () => importDOM;
      }
    }
  }
  return { ownNodeConfig, ownNodeType };
}

export function getRegisteredNode(
  editor: LexicalEditor,
  nodeType: string,
): undefined | RegisteredNode {
  return editor._nodes.get(nodeType);
}
