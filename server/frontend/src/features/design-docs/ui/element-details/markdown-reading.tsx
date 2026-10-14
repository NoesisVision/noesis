import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import classes from './markdown-reading.module.css';

/**
 * A description the design writes in markdown, read in the type of the text
 * around it — a card's, a column's — rather than the editor's own. The
 * editor reads its markdown once, on mount, so it is keyed by the text; it
 * arrives on its own, and a line of prose has no room for a loading line.
 */
export function MarkdownReading({ markdown }: { markdown: string }) {
  return (
    <div className={classes.reading}>
      <MarkdownEditor
        key={markdown}
        markdown={markdown}
        headingLevel={4}
        readOnly
        noMargin
        fallback={null}
      />
    </div>
  );
}
