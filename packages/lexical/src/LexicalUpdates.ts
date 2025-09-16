import { LexicalEditor } from './LexicalEditor';

let activeEditor: null | LexicalEditor = null;

export function internalGetActiveEditor(): LexicalEditor | null {
  return activeEditor;
}
