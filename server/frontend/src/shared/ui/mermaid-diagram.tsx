import { useEffect, useId, useState } from 'react';
import { Alert } from '#/shared/design-system/alert.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Text } from '#/shared/design-system/text.tsx';
import classes from './markdown.module.css';

type Drawing =
  | { state: 'drawing' }
  | { state: 'drawn'; svg: string }
  | { state: 'failed'; reason: string };

/**
 * One mermaid fence from a markdown document. Mermaid is a megabyte and needs
 * the DOM, so it is imported the first time a diagram is on screen rather than
 * with the bundle, and the document reads fine in the moment before it lands.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const scheme = useComputedColorScheme('light');
  const [drawing, setDrawing] = useState<Drawing>({ state: 'drawing' });
  // `useId` is stable across renders but contains colons, which are not valid
  // in the DOM id mermaid puts on the element it renders through.
  const id = `mermaid-${useId().replaceAll(':', '')}`;

  // Nothing is reset here on the way in: a redraw for a new theme keeps the
  // diagram already on screen until its replacement is ready, rather than
  // blinking through the loading line.
  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: scheme === 'dark' ? 'dark' : 'default',
        });
        const { svg } = await mermaid.render(id, chart);
        if (live) setDrawing({ state: 'drawn', svg });
      } catch (error) {
        if (live) setDrawing({ state: 'failed', reason: String(error) });
      }
    })();

    return () => {
      live = false;
    };
  }, [chart, id, scheme]);

  if (drawing.state === 'drawing') {
    return (
      <Text component="output" c="dimmed" size="sm">
        Drawing diagram…
      </Text>
    );
  }

  if (drawing.state === 'failed') {
    return (
      <Alert color="red" title="Could not draw this diagram">
        <Text size="sm">{drawing.reason}</Text>
        <Text component="pre" size="sm" className={classes.diagramSource}>
          {chart}
        </Text>
      </Alert>
    );
  }

  // Mermaid hands back a finished SVG document, which is the only shape it
  // renders to; `securityLevel: 'strict'` is what keeps the input from
  // reaching the output unescaped.
  return (
    <div
      className={classes.diagram}
      // oxlint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: drawing.svg }}
    />
  );
}
