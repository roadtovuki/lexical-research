import {
  LexicalNode,
  LexicalUpdateJSON,
  SerializedLexicalNode,
} from './LexicalNode';
import invariant from 'shared/invariant';
import { $getEditor, getRegisteredNodeOrThrow } from './LexicalUtils';
import { NODE_STATE_KEY } from './LexicalConstants';

function coerceToJSON(v: unknown): unknown {
  return v;
}

/**
 * Configure a value to be used with StateConfig.
 *
 * The value type should be inferred from the definition of parse.
 *
 * If the value type is not JSON serializable, then unparse must also be provided.
 *
 * Values should be treated as immutable, much like React.useState. Mutating
 * stored values directly will cause unpredictable behavior, is not supported,
 * and may trigger errors in the future.
 *
 * @example
 * ```ts
 * const numberOrNullState = createState('numberOrNull', {parse: (v) => typeof v === 'number' ? v : null});
 * //    ^? State<'numberOrNull', StateValueConfig<number | null>>
 * const numberState = createState('number', {parse: (v) => typeof v === 'number' ? v : 0});
 * //    ^? State<'number', StateValueConfig<number>>
 * ```
 *
 * Only the parse option is required, it is generally not useful to
 * override `unparse` or `isEqual`. However, if you are using
 * non-primitive types such as Array, Object, Date, or something
 * more exotic then you would want to override this. In these
 * cases you might want to reach for third party libraries.
 *
 * @example
 * ```ts
 * const isoDateState = createState('isoDate', {
 *   parse: (v): null | Date => {
 *     const date = typeof v === 'string' ? new Date(v) : null;
 *     return date && !isNaN(date.valueOf()) ? date : null;
 *   }
 *   isEqual: (a, b) => a === b || (a && b && a.valueOf() === b.valueOf()),
 *   unparse: (v) => v && v.toString()
 * });
 * ```
 *
 * You may find it easier to write a parse function using libraries like
 * zod, valibot, ajv, Effect, TypeBox, etc. perhaps with a wrapper function.
 */
export interface StateValueConfig<V> {
  /**
   * This function must return a default value when called with undefined,
   * otherwise it should parse the given JSON value to your type V. Note
   * that it is not required to copy or clone the given value, you can
   * pass it directly through if it matches the expected type.
   *
   * When you encounter an invalid value, it's up to you to decide
   * as to whether to ignore it and return the default value,
   * return some non-default error value, or throw an error.
   *
   * It is possible for V to include undefined, but if it does, then
   * it should also be considered the default value since undefined
   * can not be serialized to JSON so it is indistinguishable from the
   * default.
   *
   * Similarly, if your V is a function, then usage of {@link $setState}
   * must use an updater function because your type will be indistinguishable
   * from an updater function.
   */
  parse: (jsonValue: unknown) => V;
  /**
   * This is optional and for advanced use cases only.
   *
   * You may specify a function that converts V back to JSON.
   * This is mandatory when V is not a JSON serializable type.
   */
  unparse?: (parsed: V) => unknown;
  /**
   * This is optional and for advanced use cases only.
   *
   * Used to define the equality function so you can use an Array or Object
   * as V and still omit default values from the exported JSON.
   *
   * The default is `Object.is`, but something like `fast-deep-equal` might be
   * more appropriate for your use case.
   */
  isEqual?: (a: V, b: V) => boolean;
}

export class StateConfig<K extends string, V> {
  /** The string key used when serializing this state to JSON */
  readonly key: K;
  /** The parse function from the StateValueConfig passed to createState */
  readonly parse: (value?: unknown) => V;
  /**
   * The unparse function from the StateValueConfig passed to createState,
   * with a default that is simply a pass-through that assumes the value is
   * JSON serializable.
   */
  readonly unparse: (value: V) => unknown;
  /**
   * An equality function from the StateValueConfig, with a default of
   * Object.is.
   */
  readonly isEqual: (a: V, b: V) => boolean;
  /**
   * The result of `stateValueConfig.parse(undefined)`, which is computed only
   * once and used as the default value. When the current value `isEqual` to
   * the `defaultValue`, it will not be serialized to JSON.
   */
  readonly defaultValue: V;
  constructor(key: K, stateValueConfig: StateValueConfig<V>) {
    this.key = key;
    this.parse = stateValueConfig.parse.bind(stateValueConfig);
    this.unparse = (stateValueConfig.unparse || coerceToJSON).bind(
      stateValueConfig,
    );
    this.isEqual = (stateValueConfig.isEqual || Object.is).bind(
      stateValueConfig,
    );
    this.defaultValue = this.parse(undefined);
  }
}

/**
 * For advanced use cases, using this type is not recommended unless
 * it is required (due to TypeScript's lack of features like
 * higher-kinded types).
 *
 * A {@link StateConfig} type with any key and any value that can be
 * used in situations where the key and value type can not be known,
 * such as in a generic constraint when working with a collection of
 * StateConfig.
 *
 * {@link StateConfigKey} and {@link StateConfigValue} will be
 * useful when this is used as a generic constraint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyStateConfig = StateConfig<any, any>;

export interface NodeStateConfig<S extends AnyStateConfig> {
  stateConfig: S;
  flat?: boolean;
}

export type RequiredNodeStateConfig =
  | NodeStateConfig<AnyStateConfig>
  | AnyStateConfig;

/**
 * @internal
 *
 * A Map of string keys to state configurations to be shared across nodes
 * and/or node versions.
 */
type SharedConfigMap = Map<string, AnyStateConfig>;

/**
 * @internal
 *
 * Opaque state to be stored on the editor's RegisterNode for use by NodeState
 */
export type SharedNodeState = {
  sharedConfigMap: SharedConfigMap;
  flatKeys: Set<string>;
};

type KnownStateMap = Map<AnyStateConfig, unknown>;
type UnknownStateRecord = Record<string, unknown>;

function computeSize(
  sharedConfigMap: SharedConfigMap,
  unknownState: UnknownStateRecord | undefined,
  knownState: KnownStateMap,
): number {
  let size = knownState.size;
  if (unknownState) {
    for (const k in unknownState) {
      const sharedConfig = sharedConfigMap.get(k);
      if (!sharedConfig || !knownState.has(sharedConfig)) {
        size++;
      }
    }
  }
  return size;
}

function parseAndPruneNextUnknownState(
  sharedConfigMap: SharedConfigMap,
  nextKnownState: KnownStateMap,
  unknownState: undefined | UnknownStateRecord,
): undefined | UnknownStateRecord {
  let nextUnknownState: undefined | UnknownStateRecord = undefined;
  if (unknownState) {
    for (const [k, v] of Object.entries(unknownState)) {
      const stateConfig = sharedConfigMap.get(k);
      if (stateConfig) {
        if (!nextKnownState.has(stateConfig)) {
          nextKnownState.set(stateConfig, stateConfig.parse(v));
        }
      } else {
        nextUnknownState = nextUnknownState || {};
        nextUnknownState[k] = v;
      }
    }
  }
  return nextUnknownState;
}

function undefinedIfEmpty<T extends object>(obj: undefined | T): undefined | T {
  if (obj) {
    for (const key in obj) {
      return obj;
    }
  }
  return undefined;
}

export class NodeState<T extends LexicalNode> {
  /**
   *
   *
   * Track the (versioned) node that this NodeState was created for, to
   * facilitate copy-on-write for NodeState. When a LexicalNode is cloned,
   * it will *reference* the NodeState from its prevNode. From the nextNode
   * you can continue to read state without copying, but the first $setState
   * will trigger a copy of the prevNode's NodeState with the node property
   * updated.
   */
  readonly node: LexicalNode;

  /**
   *
   *
   * State that has already been parsed in a get state, so it is safe. (can be returned with
   * just a cast since the proof was given before).
   *
   * Note that it uses StateConfig, so in addition to (1) the CURRENT VALUE, it has access to
   * (2) the State key (3) the DEFAULT VALUE and (4) the PARSE FUNCTION
   */

  readonly knownState: KnownStateMap;

  /**
   *
   *
   * A copy of serializedNode[NODE_STATE_KEY] that is made when JSON is
   * imported but has not been parsed yet.
   *
   * It stays here until a get state requires us to parse it, and since we
   * then know the value is safe we move it to knownState.
   *
   * Note that since only string keys are used here, we can only allow this
   * state to pass-through on export or on the next version since there is
   * no known value configuration. This pass-through is to support scenarios
   * where multiple versions of the editor code are working in parallel so
   * an old version of your code doesnt erase metadata that was
   * set by a newer version of your code.
   */

  unknownState: undefined | UnknownStateRecord;

  /**
   *
   *
   * This sharedNodeState is preserved across all instances of a given
   * node type in an editor and remains writable. It is how keys are resolved
   * to configuration.
   */

  readonly sharedNodeState: SharedNodeState;

  /**
   *
   *
   * The count of known or unknown keys in this state, ignoring the
   * intersection between the two sets.
   */

  size: number;

  constructor(
    node: T,
    sharedNodeState: SharedNodeState,
    unknownState: undefined | UnknownStateRecord = undefined,
    knownState: KnownStateMap = new Map(),
    size: number | undefined = undefined,
  ) {
    this.node = node;
    this.sharedNodeState = sharedNodeState;
    this.unknownState = unknownState;
    this.knownState = knownState;
    const { sharedConfigMap } = this.sharedNodeState;
    const computedSize =
      size !== undefined
        ? size
        : computeSize(sharedConfigMap, unknownState, knownState);
    if (__DEV__) {
      invariant(
        size === undefined || computedSize === size,
        'NodeState: size != computedSize (%s != %s)',
        String(size),
        String(computedSize),
      );
      for (const stateConfig of knownState.keys()) {
        invariant(
          sharedConfigMap.has(stateConfig.key),
          'NodeState: sharedConfigMap missing knownState key %s',
          stateConfig.key,
        );
      }
    }
    this.size = computedSize;
  }

  getWritable(node: T): NodeState<T> {
    if (this.node === node) {
      return this;
    }
    const { sharedNodeState, unknownState } = this;
    const nextKnownState = new Map(this.knownState);
    return new NodeState(
      node,
      sharedNodeState,
      parseAndPruneNextUnknownState(
        sharedNodeState.sharedConfigMap,
        nextKnownState,
        unknownState,
      ),
      nextKnownState,
      this.size,
    );
  }

  updateFromKnown<K extends string, V>(
    stateConfig: StateConfig<K, V>,
    value: V,
  ): void {
    const key = stateConfig.key;
    this.sharedNodeState.sharedConfigMap.set(key, stateConfig);
    const { knownState, unknownState } = this;
    if (
      !(knownState.has(stateConfig) || (unknownState && key in unknownState))
    ) {
      if (unknownState) {
        delete unknownState[key];
        this.unknownState = undefinedIfEmpty(unknownState);
      }
      this.size++;
    }
    knownState.set(stateConfig, value);
  }

  updateFromUnknown(k: string, v: unknown): void {
    const stateConfig = this.sharedNodeState.sharedConfigMap.get(k);
    if (stateConfig) {
      this.updateFromKnown(stateConfig, stateConfig.parse(v));
    } else {
      this.unknownState = this.unknownState || {};
      if (!(k in this.unknownState)) {
        this.size++;
      }
      this.unknownState[k] = v;
    }
  }

  updateFromJSON(unknownState: undefined | UnknownStateRecord): void {
    const { knownState } = this;
    // Reset all known state to defaults
    for (const stateConfig of knownState.keys()) {
      knownState.set(stateConfig, stateConfig.defaultValue);
    }
    // Since we are resetting all state to this new record,
    // the size starts at the number of known keys
    // and will be updated as we traverse the new state
    this.size = knownState.size;
    this.unknownState = undefined;
    if (unknownState) {
      for (const [k, v] of Object.entries(unknownState)) {
        this.updateFromUnknown(k, v);
      }
    }
  }
}

export function $getSharedNodeState<T extends LexicalNode>(
  node: T,
): SharedNodeState {
  return node.__state
    ? node.__state.sharedNodeState
    : getRegisteredNodeOrThrow($getEditor(), node.getType()).sharedNodeState;
}

export function $getWritableNodeState<T extends LexicalNode>(
  node: T,
): NodeState<T> {
  const writable = node.getWritable();
  const state = writable.__state
    ? writable.__state.getWritable(writable)
    : new NodeState(writable, $getSharedNodeState(writable));
  writable.__state = state;
  return state;
}

export function $updateStateFromJSON<T extends LexicalNode>(
  node: T,
  serialized: LexicalUpdateJSON<SerializedLexicalNode>,
): T {
  const writable = node.getWritable();
  const unknownState = serialized[NODE_STATE_KEY];
  let parseState = unknownState;
  for (const k of $getSharedNodeState(writable).flatKeys) {
    if (k in serialized) {
      if (parseState === undefined || parseState === unknownState) {
        parseState = { ...unknownState };
      }
      parseState[k] = serialized[k as keyof typeof serialized];
    }
  }
  if (writable.__state || parseState) {
    $getWritableNodeState(node).updateFromJSON(parseState);
  }
  return writable;
}
