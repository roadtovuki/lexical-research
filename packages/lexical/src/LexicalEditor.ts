import { internalGetActiveEditor } from './LexicalUpdates';
import { createEmptyEditorState } from './LexicalEditorState';
import { DOMExportOutput, LexicalNode, NodeKey } from './LexicalNode';
import { SharedNodeState } from './LexicalNodeState';

// Refers to a class (the factory), not an instance
type GenericConstructor<T> = new (...args: any[]) => T;

// Describes the class (the factory) with all its statis properties
// You have the architect's blueprint in your hand. This type describes it.
export type KlassConstructor<Cls extends GenericConstructor<any>> =
  GenericConstructor<InstanceType<Cls>> & { [k in keyof Cls]: Cls[k] };

// You have a finished car. This type helps you find the original blueprint for that specific car.
// It asks:
// "Is the constructor property on this object typed well enough for TypeScript to know it creates this exact type of object?"
// To infer or recover the class constructor type from an object that already exists. You are asking TypeScript what it is.
export type Klass<T extends LexicalNode> = InstanceType<
  T['constructor']
> extends T
  ? T['constructor']
  : GenericConstructor<T> & T['constructor'];

export type EditorThemeClasses = {};

export type Transform<T extends LexicalNode> = (node: T) => void;

export type RegisteredNode = {
  klass: Klass<LexicalNode>;
  transforms: Set<Transform<LexicalNode>>;
  replace: null | ((node: LexicalNode) => LexicalNode);
  replaceWithKlass: null | Klass<LexicalNode>;
  exportDOM?: (
    editor: LexicalEditor,
    targetNode: LexicalNode,
  ) => DOMExportOutput;
  sharedNodeState: SharedNodeState;
};

export type RegisteredNodes = Map<string, RegisteredNode>;

export type CreateEditorArgs = {
  disableEvents?: boolean;
  parentEditor?: LexicalEditor;
  theme?: EditorThemeClasses;
};

type IntentionallyMarkedAsDirtyElement = boolean;

export function createEditor(editorConfig?: CreateEditorArgs): LexicalEditor {
  const config = editorConfig || {};
  const activeEditor = internalGetActiveEditor();
  const theme = config.theme || {};
  const parentEditor =
    editorConfig === undefined ? activeEditor : config.parentEditor || null;
  const disableEvents = config.disableEvents || false;
  const editorState = createEmptyEditorState();

  const editor = new LexicalEditor();

  return editor;
}

export class LexicalEditor {
  /** @internal */
  declare ['constructor']: KlassConstructor<typeof LexicalEditor>;

  /** The version with build identifiers for this editor (since 0.17.1) */
  static version: string | undefined;

  /** @internal */
  _nodes: RegisteredNodes;
  /** @internal */
  _dirtyType: 0 | 1 | 2;
  /** @internal */
  _cloneNotNeeded: Set<NodeKey>;
  /** @internal */
  _dirtyLeaves: Set<NodeKey>;
  /** @internal */
  _dirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>;
}
