import { NODE_STATE_KEY } from './LexicalConstants';
import type { Klass, KlassConstructor } from './LexicalEditor';
import {
  $updateStateFromJSON,
  NodeState,
  RequiredNodeStateConfig,
} from './LexicalNodeState';
import invariant from 'shared/invariant';
import {
  $cloneWithProperties,
  $getNodeByKey,
  $setNodeKey,
  getRegisteredNode,
  getStaticNodeConfig,
  internalMarkNodeAsDirty,
} from './LexicalUtils';
import {
  errorOnReadOnly,
  getActiveEditor,
  getActiveEditorState,
} from './LexicalUpdates';
import { $getSelection } from './LexicalSelection';

export type NodeMap = Map<NodeKey, LexicalNode>;

export type NodeKey = string;

type NodeName = string;

// ************ DOM CONVERSION *********************

export type DOMChildConversion = (
  lexicalNode: LexicalNode,
  parentLexicalNode: LexicalNode | null | undefined,
) => LexicalNode | null | undefined;

export type DOMConversionOutput = {
  after?: (childLexicalNodes: Array<LexicalNode>) => Array<LexicalNode>;
  forChild?: DOMChildConversion;
  node: null | LexicalNode | Array<LexicalNode>;
};

export type DOMConversionFn<T extends HTMLElement = HTMLElement> = (
  element: T,
) => DOMConversionOutput | null;

export type DOMConversion<T extends HTMLElement = HTMLElement> = {
  conversion: DOMConversionFn<T>;
  priority?: 0 | 1 | 2 | 3 | 4;
};

export type DOMConversionProp<T extends HTMLElement> = (
  node: T,
) => DOMConversion<T> | null;

export type DOMConversionMap<T extends HTMLElement = HTMLElement> = Record<
  NodeName,
  DOMConversionProp<T>
>;

export type DOMExportOutput = {
  after?: (
    generatedElement: HTMLElement | DocumentFragment | Text | null | undefined,
  ) => HTMLElement | DocumentFragment | Text | null | undefined;
  element: HTMLElement | DocumentFragment | Text | null;
};

// ************ END OF DOM CONVERSION *********************

export type SerializedLexicalNode = {
  /** The type string used by the Node class */
  type: string;
  /** A numeric version for this schema, defaulting to 1, but not generally recommended for use */
  version: number;
  /**
   * Any state persisted with the NodeState API that is not
   * configured for flat storage
   */
  [NODE_STATE_KEY]?: Record<string, unknown>;
};

export type LexicalUpdateJSON<T extends SerializedLexicalNode> = Omit<
  T,
  'children' | 'type' | 'version'
>;

export interface StaticNodeConfigValue<
  T extends LexicalNode,
  Type extends string,
> {
  /**
   * The exact type of T.getType(), e.g. 'text' - the method itself must
   * have a more generic 'string' type to be compatible with subclassing.
   */
  readonly type?: Type;
  /**
   * An alternative to the internal static transform() method
   * that provides better type inference.
   */
  readonly $transform?: (node: T) => void;
  /**
   * An alternative to the static importJSON() method
   * that provides better type inference.
   */
  readonly $importJSON?: (serializedNode: SerializedLexicalNode) => T;
  /**
   * An alternative to the static importDOM() method
   */
  readonly importDOM?: DOMConversionMap;
  readonly stateConfigs?: readonly RequiredNodeStateConfig[];
  readonly extends?: Klass<LexicalNode>;
}

export type BaseStaticNodeConfig = {
  readonly [K in string]?: StaticNodeConfigValue<LexicalNode, string>;
};

function errorOnTypeKlassMismatch(
  type: string,
  klass: Klass<LexicalNode>,
): void {
  const registeredNode = getRegisteredNode(getActiveEditor(), type);
  // Common error - split in its own invariant
  if (registeredNode === undefined) {
    invariant(
      false,
      'Create node: Attempted to create node %s that was not configured to be used on the editor.',
      klass.name,
    );
  }
  const editorKlass = registeredNode.klass;
  if (editorKlass !== klass) {
    invariant(
      false,
      'Create node: Type %s in node %s does not match registered node %s with the same type',
      type,
      klass.name,
      editorKlass.name,
    );
  }
}

export class LexicalNode {
  /** @internal Allow us to look up the type including static props */
  declare ['constructor']: KlassConstructor<typeof LexicalNode>;
  /** @internal */
  __type: string;
  /** @internal */
  //@ts-ignore We set the key in the constructor.
  __key: string;
  /** @internal */
  __parent: null | NodeKey;
  /** @internal */
  __prev: null | NodeKey;
  /** @internal */
  __next: null | NodeKey;
  /** @internal */
  __state?: NodeState<this>;

  // Flow doesn't support abstract classes unfortunately, so we can't _force_
  // subclasses of Node to implement statics. All subclasses of Node should have
  // a static getType and clone method though. We define getType and clone here so we can call it
  // on any  Node, and we throw this error by default since the subclass should provide
  // their own implementation.
  /**
   * Returns the string type of this node. Every node must
   * implement this and it MUST BE UNIQUE amongst nodes registered
   * on the editor.
   *
   */

  static getType(): string {
    const { ownNodeType } = getStaticNodeConfig(this);
    invariant(
      ownNodeType !== undefined,
      'LexicalNode: Node %s does not implement .getType().',
      this.name,
    );
    return ownNodeType;
  }

  static clone(_data: unknown): LexicalNode {
    invariant(
      false,
      'LexicalNode: Node %s does not implement .clone().',
      this.name,
    );
  }

  static importJSON(_serializedNode: SerializedLexicalNode): LexicalNode {
    invariant(
      false,
      'LexicalNode: Node %s does not implement .importJSON().',
      this.name,
    );
  }

  static importDOM?: () => DOMConversionMap<any> | null;

  constructor(key?: NodeKey) {
    this.__type = this.constructor.getType();
    this.__parent = null;
    this.__prev = null;
    this.__next = null;
    Object.defineProperty(this, '__state', {
      configurable: true,
      enumerable: false,
      value: undefined,
      writable: true,
    });
    $setNodeKey(this, key);

    if (__DEV__) {
      if (this.__type !== 'root') {
        errorOnReadOnly();
        errorOnTypeKlassMismatch(this.__type, this.constructor);
      }
    }
  }

  $config(): BaseStaticNodeConfig {
    return {};
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedLexicalNode>,
  ): this {
    return $updateStateFromJSON(this, serializedNode);
  }

  getType(): string {
    return this.__type;
  }

  getLatest(): this {
    const latest = $getNodeByKey<this>(this.__key);
    if (latest === null) {
      invariant(
        false,
        'Lexical node does not exist in active editor state. Avoid using the same node references between nested closures from editorState.read/editor.update.',
      );
    }
    return latest;
  }

  afterCloneFrom(prevNode: this): void {
    if (this.__key === prevNode.__key) {
      this.__parent = prevNode.__parent;
      this.__next = prevNode.__next;
      this.__prev = prevNode.__prev;
      this.__state = prevNode.__state;
    } else if (prevNode.__state) {
      this.__state = prevNode.__state.getWritable(this);
    }
  }

  getWritable(): this {
    errorOnReadOnly();
    const editorState = getActiveEditorState();
    const editor = getActiveEditor();
    const nodeMap = editorState._nodeMap;
    const key = this.__key;
    // Ensure we get the latest node from pending state
    const latestNode = this.getLatest();
    const cloneNotNeeded = editor._cloneNotNeeded;
    const selection = $getSelection();
    if (selection !== null) {
      selection.setCachedNodes(null);
    }
    if (cloneNotNeeded.has(key)) {
      // Transforms clear the dirty node set on each iteration to keep track on newly dirty nodes
      internalMarkNodeAsDirty(latestNode);
      return latestNode;
    }
    const mutableNode = $cloneWithProperties(latestNode);
    cloneNotNeeded.add(key);
    internalMarkNodeAsDirty(mutableNode);
    // Update reference in node map
    nodeMap.set(key, mutableNode);

    return mutableNode;
  }
}
