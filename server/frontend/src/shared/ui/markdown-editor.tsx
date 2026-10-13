import { lazy, type ReactNode, Suspense } from 'react';
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
 * editor under a different `key`. Until it arrives, `fallback` shows in its
 * place: a loading line by default; `null` where a line is too much, as in a
 * small box — never the markdown itself, painted as the text it is written in.
 */
export function MarkdownEditor({
  fallback,
  ...props
}: MarkdownEditorProps & { fallback?: ReactNode }) {
  return (
    <Suspense
      fallback={
        fallback === undefined ? (
          <LoadingPanel label="Opening the editor…" />
        ) : (
          fallback
        )
      }
    >
      <Surface {...props} />
    </Suspense>
  );
}
