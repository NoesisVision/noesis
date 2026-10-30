import { IconMaximize } from '@tabler/icons-react';
import { useEffect, useId, useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import {
  useDisclosure,
  useMantineTheme,
} from '#/shared/design-system/hooks.ts';
import { Text } from '#/shared/design-system/text.tsx';
import { MermaidCanvas } from './mermaid-canvas/mermaid-canvas.tsx';
import {
  type DiagramGraph,
  graphKindOf,
  graphOf,
  type MermaidDiagramData,
} from './mermaid-canvas/mermaid-graph.ts';
import {
  type DiagramLayout,
  layoutDiagram,
  type Measure,
} from './mermaid-canvas/mermaid-layout.ts';
import {
  type MermaidSequenceDb,
  sequenceOf,
} from './mermaid-canvas/mermaid-sequence.ts';
import { diagramCss, diagramTheme } from './mermaid-diagram-theme.ts';
import { MermaidViewer } from './mermaid-viewer.tsx';
import classes from './mermaid-diagram.module.css';

type Drawing =
  | { state: 'drawing' }
  | { state: 'drawn'; svg: string }
  | { state: 'graph'; graph: DiagramGraph; layout: DiagramLayout }
  | { state: 'failed'; reason: string };

/** What mermaid's parser keeps of a diagram, as far as it is read here. */
interface ParsedDb {
  getData?: () => Omit<MermaidDiagramData, 'type'>;
  getDirection?: () => string | undefined;
}

let measuring: CanvasRenderingContext2D | null = null;
/** A line of words' width in a font, as the page will draw it. */
const measure: Measure = (text, font) => {
  measuring ??= document.createElement('canvas').getContext('2d');
  if (measuring === null) return text.length * 7;
  measuring.font = font;
  return measuring.measureText(text).width;
};

/**
 * The diagram as the app draws it on its own canvas: a graph read by mermaid's
 * parser and placed by ELK (mermaid-canvas/mermaid-graph.ts), or a sequence
 * laid out down its lifelines (mermaid-sequence.ts). None for any other kind,
 * which mermaid draws itself.
 */
async function graphFor(
  mermaid: typeof import('mermaid').default,
  chart: string,
): Promise<{ graph: DiagramGraph; layout: DiagramLayout } | null> {
  const parsed = await mermaid.mermaidAPI.getDiagramFromText(chart);
  if (parsed.type === 'sequence') {
    await document.fonts?.ready;
    return sequenceOf(parsed.db as MermaidSequenceDb, measure);
  }
  if (graphKindOf(parsed.type) === null) return null;
  const db = parsed.db as ParsedDb;
  const data = db.getData?.();
  if (data === undefined) return null;
  const graph = graphOf({
    ...data,
    type: parsed.type,
    direction: db.getDirection?.() ?? data.direction,
  });
  if (graph === null || graph.boxes.length === 0) return null;
  // Sized by the words as the page draws them, so in its own font.
  await document.fonts?.ready;
  return { graph, layout: await layoutDiagram(graph, measure) };
}

/**
 * One mermaid fence from a markdown document. Mermaid is a megabyte and needs
 * the DOM, so it is imported the first time a diagram is on screen rather than
 * with the bundle, and the document reads fine in the moment before it lands.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const scheme = useComputedColorScheme('light');
  const theme = useMantineTheme();
  const [drawing, setDrawing] = useState<Drawing>({ state: 'drawing' });
  const [viewing, viewer] = useDisclosure(false);
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
          // `base` is the theme mermaid means to be overridden; the named
          // ones ignore most of what is handed to them.
          theme: 'base',
          themeVariables: diagramTheme(theme, scheme),
          themeCSS: diagramCss(theme, scheme),
        });
        const drawn = await graphFor(mermaid, chart);
        if (drawn !== null) {
          if (live) setDrawing({ state: 'graph', ...drawn });
          return;
        }
        const { svg } = await mermaid.render(id, chart);
        if (live) setDrawing({ state: 'drawn', svg });
      } catch (error) {
        if (live) setDrawing({ state: 'failed', reason: String(error) });
      }
    })();

    return () => {
      live = false;
    };
  }, [chart, id, scheme, theme]);

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

  const name = diagramName(chart);
  if (drawing.state === 'graph') {
    return (
      <>
        <MermaidCanvas
          graph={drawing.graph}
          layout={drawing.layout}
          name={name}
          onFullScreen={viewer.open}
        />
        <MermaidViewer name={name} opened={viewing} onClose={viewer.close}>
          <MermaidCanvas
            graph={drawing.graph}
            layout={drawing.layout}
            name={name}
            fullScreen
          />
        </MermaidViewer>
      </>
    );
  }

  // Mermaid hands back a finished SVG document, which is the only shape it
  // renders to; `securityLevel: 'strict'` is what keeps the input from
  // reaching the output unescaped. The wrapper carries the name, because the
  // SVG inside it is a picture and arrives without one.
  return (
    <Box className={classes.frame}>
      <Box
        className={classes.diagram}
        // Not an `img`: the picture is an inline SVG document mounted here, and
        // an `img` cannot hold one. The role is what names it.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="img"
        aria-label={name}
        // oxlint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: drawing.svg }}
      />
      {/* Placed by a wrapper: Mantine's own `position` on the button comes
          later in the bundle than a class on it could. */}
      <Box className={classes.expand}>
        <ActionIcon
          variant="default"
          aria-label="Open diagram full screen"
          title="Open diagram full screen"
          onClick={viewer.open}
        >
          <IconMaximize size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
      </Box>
      <MermaidViewer
        svg={drawing.svg}
        name={name}
        opened={viewing}
        onClose={viewer.close}
      />
    </Box>
  );
}

/**
 * What the diagram is called. Mermaid's own `accTitle:` is the author's
 * answer and the only one worth reading aloud; without it the kind of
 * diagram is all the source says.
 */
function diagramName(chart: string): string {
  const lines = chart.split('\n');
  for (const line of lines) {
    const declared = accessibleTitle(line);
    if (declared !== null) return declared;
  }
  return `${diagramKind(lines)} diagram`;
}

const ACC_TITLE = 'accTitle:';
/** Mermaid's accessibility directives, which never name the kind. */
const ACC_PREFIX = 'acc';

/** Read off the line rather than matched: a document's text is unbounded. */
function accessibleTitle(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(ACC_TITLE)) return null;
  const declared = trimmed.slice(ACC_TITLE.length).trim();
  return declared === '' ? null : declared;
}

/** The first word that declares a diagram, past any directive above it. */
function diagramKind(lines: string[]): string {
  for (const line of lines) {
    const word = line.trim().split(/\s/)[0] ?? '';
    if (word !== '' && !word.startsWith(ACC_PREFIX)) {
      return word.replace(/-v\d+$/, '');
    }
  }
  return 'mermaid';
}
