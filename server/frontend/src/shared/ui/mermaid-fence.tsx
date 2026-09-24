import {
  type CodeBlockEditorProps,
  readOnly$,
  useCellValue,
  useCodeBlockEditorContext,
} from '@mdxeditor/editor';
import { useEffect, useState } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { MermaidDiagram } from './mermaid-diagram.tsx';
import classes from './markdown-editor.module.css';

/** Mermaid draws nothing from half-typed syntax, so the picture waits. */
const SETTLE_MS = 500;

export function MermaidFence({ code }: CodeBlockEditorProps) {
  const { setCode } = useCodeBlockEditorContext();
  const readOnly = useCellValue(readOnly$);

  // A reader is shown the picture the fence describes and not the fence, which
  // is what the document looked like before it could be edited at all.
  if (readOnly) return <Drawing source={code} />;
  return <MermaidSource source={code} onChange={setCode} />;
}

/**
 * A mermaid fence, edited as source with the picture beside it. Mermaid has no
 * CodeMirror language, so the generic code editor would show the text and
 * nothing more; what an author needs to see is the diagram it draws.
 */
export function MermaidSource({
  source,
  onChange,
}: {
  source: string;
  onChange: (source: string) => void;
}) {
  const [draft, setDraft] = useState(source);
  const settled = useSettled(draft);

  return (
    <div className={classes.fence}>
      <textarea
        className={classes.fenceSource}
        aria-label="Mermaid diagram source"
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
        // Lexical listens for keys across the document it owns, but what is
        // typed in here belongs to the textarea and must not also reach it.
        onKeyDown={(event) => event.nativeEvent.stopImmediatePropagation()}
      />
      <div className={classes.fencePreview}>
        <Drawing source={settled} />
      </div>
    </div>
  );
}

function Drawing({ source }: { source: string }) {
  if (source.trim() === '') {
    return (
      <Text c="dimmed" size="sm">
        Write a diagram to see it drawn.
      </Text>
    );
  }
  return <MermaidDiagram chart={source} />;
}

function useSettled(value: string): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  return settled;
}
