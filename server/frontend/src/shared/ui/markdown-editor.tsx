import { lazy, Suspense } from 'react';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import type { MarkdownEditorProps } from './markdown-editor-surface.tsx';

const Surface = lazy(() => import('./markdown-editor-surface.tsx'));

/**
 * Markdown, editable: MDXEditor with a mermaid fence that draws itself as it
 * is written. Lexical, CodeMirror and mermaid together are far more than a
 * reader needs, so they arrive when an editor is opened rather than with the
 * bundle.
 *
 * `markdown` is read once, on mount — to open a different document, mount the
 * editor under a different `key`.
 */
export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <Suspense fallback={<LoadingPanel label="Opening the editor…" />}>
      <Surface {...props} />
    </Suspense>
  );
}
