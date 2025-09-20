import { internalGetActiveEditor } from './LexicalUpdates';
import { createEmptyEditorState } from './LexicalEditorState';
import { LexicalNode } from './LexicalNode';

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

export type CreateEditorArgs = {
  disableEvents?: boolean;
  parentEditor?: LexicalEditor;
  theme?: EditorThemeClasses;
};

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

export class LexicalEditor {}
