import { LexicalNode } from './LexicalNode';
import { getActiveEditorState } from './LexicalUpdates';

export interface BaseSelection {
  setCachedNodes(nodes: LexicalNode[] | null): void;
}

export function $getSelection(): null | BaseSelection {
  const editorState = getActiveEditorState();
  return editorState._selection;
}
