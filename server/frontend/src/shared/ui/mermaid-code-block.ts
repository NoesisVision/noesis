import type { CodeBlockEditorDescriptor } from '@mdxeditor/editor';
import { MermaidFence } from './mermaid-fence.tsx';

export const MERMAID_LANGUAGE = 'mermaid';

/** The fence the toolbar inserts, named the way a diagram has to be. */
export const NEW_DIAGRAM = [
  'flowchart TD',
  '  accTitle: Untitled diagram',
  '  A[Start] --> B[Finish]',
].join('\n');

/**
 * Above the CodeMirror editor, which registers itself at 1 and would otherwise
 * take every fence.
 */
const ABOVE_CODE_MIRROR = 10;

export const mermaidCodeBlock: CodeBlockEditorDescriptor = {
  priority: ABOVE_CODE_MIRROR,
  match: (language) => language === MERMAID_LANGUAGE,
  Editor: MermaidFence,
};
