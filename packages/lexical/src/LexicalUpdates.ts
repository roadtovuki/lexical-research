import invariant from 'shared/invariant';
import { LexicalEditor } from './LexicalEditor';
import { getEditorPropertyFromDOMNode, isLexicalEditor } from './LexicalUtils';

let activeEditor: null | LexicalEditor = null;
let isReadOnlyMode = false;

function collectBuildInformation(): string {
  let compatibleEditors = 0;
  const incompatibleEditors = new Set<string>();
  const thisVersion = LexicalEditor.version;
  if (typeof window !== 'undefined') {
    for (const node of document.querySelectorAll('[contenteditable]')) {
      const editor = getEditorPropertyFromDOMNode(node);
      if (isLexicalEditor(editor)) {
        compatibleEditors++;
      } else if (editor) {
        let version = String(
          (
            editor.constructor as (typeof editor)['constructor'] &
              Record<string, unknown>
          ).version || '<0.17.1',
        );
        if (version === thisVersion) {
          version +=
            ' (separately built, likely a bundler configuration issue)';
        }
        incompatibleEditors.add(version);
      }
    }
  }
  let output = ` Detected on the page: ${compatibleEditors} compatible editor(s) with version ${thisVersion}`;
  if (incompatibleEditors.size) {
    output += ` and incompatible editors with versions ${Array.from(
      incompatibleEditors,
    ).join(', ')}`;
  }
  return output;
}

export function getActiveEditor(): LexicalEditor {
  if (activeEditor === null) {
    invariant(
      false,
      'Unable to find an active editor. ' +
        'This method can only be used ' +
        'synchronously during the callback of ' +
        'editor.update() or editor.read().%s',
      collectBuildInformation(),
    );
  }
  return activeEditor;
}

export function internalGetActiveEditor(): LexicalEditor | null {
  return activeEditor;
}

export function errorOnReadOnly(): void {
  if (isReadOnlyMode) {
    invariant(false, 'Cannot use method in read-only mode.');
  }
}
