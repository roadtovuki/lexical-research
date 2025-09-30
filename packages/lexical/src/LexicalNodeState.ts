import { LexicalNode } from './LexicalNode';
import invariant from 'shared/invariant';

function coerceToJSON(v: unknown): unknown {
  return v;
}

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

export type AnyStateConfig = StateConfig<any, any>;

export interface NodeStateConfig<S extends AnyStateConfig> {
  stateConfig: S;
  flat?: boolean;
}

export type RequiredNodeStateConfig =
  | NodeStateConfig<AnyStateConfig>
  | AnyStateConfig;

type SharedConfigMap = Map<string, AnyStateConfig>;

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
}
