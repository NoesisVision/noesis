import {
  IconFoldDown,
  IconFoldUp,
  IconMaximize,
  IconMinimize,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { type ReactNode, useMemo } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import {
  useFullscreenElement,
  useLocalStorage,
  useMediaQuery,
} from '#/shared/design-system/hooks.ts';
import { Splitter } from '#/shared/design-system/splitter.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
import { ModelTree } from '#/shared/ui/model-tree.tsx';
import { expansionMemory } from '#/shared/ui/outline-memory.ts';
import {
  type ModelTreeController,
  useModelTree,
} from '#/shared/ui/use-model-tree.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DesignDocsIcon } from '../design-docs.model.ts';
import { ElementDetail } from './element-detail.tsx';
import classes from './design-doc-workbench.module.css';

/*
 * The design read as what it designs: the model on the left, the element in
 * hand on the right. The document's own name heads the page; the element's
 * name heads the panel, so the outline of the page is the outline of what is
 * being read.
 *
 * Mount it under the document's id — every piece of state here is about the
 * document open, and opening another one starts again rather than carrying a
 * selection that names nothing.
 */
export function DesignDocWorkbench({
  detail,
  node,
  query,
  onSelect,
  onQuery,
}: {
  detail: DesignDocDetail;
  node: string | null;
  query: string;
  onSelect: (path: string) => void;
  onQuery: (query: string) => void;
}) {
  const { document: doc, outline } = detail;
  const memory = useMemo(
    () => expansionMemory(`noesis.designDocs.${detail.summary.id}.expanded`),
    [detail.summary.id],
  );
  // An address naming an element this document no longer has is not an error
  // to show the reader: the design was rewritten, and the top of the tree is
  // where they would have started anyway.
  const known = outline.some((element) => element.path === node);
  const controller = useModelTree(outline, {
    selected: known ? node : (outline[0]?.path ?? null),
    onSelect,
    query,
    onQuery,
    memory,
  });
  const { ref, toggle, fullscreen } = useFullscreenElement<HTMLDivElement>();
  const fullscreenLabel = fullscreen ? 'Exit full screen' : 'Full screen';
  // A browser that refuses leaves the pane as it is, which is what the button
  // already shows, so there is nothing to report.
  const toggleFullscreen = () => void toggle().catch(() => {});
  const selected = controller.selectedNode;

  return (
    <Box component="article" ref={ref} className={classes.surface}>
      <Group justify="space-between" wrap="nowrap" className={classes.header}>
        <IconHeading
          title={doc.name.value}
          icon={DesignDocsIcon}
          description={detail.summary.implemented ? 'Implemented' : 'Draft'}
        />
        <ActionIcon
          variant="default"
          size="lg"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          onClick={toggleFullscreen}
        >
          {fullscreen ? (
            <IconMinimize size={22} stroke={1.6} aria-hidden />
          ) : (
            <IconMaximize size={22} stroke={1.6} aria-hidden />
          )}
        </ActionIcon>
      </Group>

      <Columns
        outline={
          <Stack gap="xs">
            <OutlineSearchBox controller={controller} />
            <Outline controller={controller} empty={outline.length === 0} />
          </Stack>
        }
        detail={
          selected === null ? (
            <Text c="dimmed">Choose an element to read it.</Text>
          ) : (
            <ElementDetail
              node={selected}
              path={controller.tree
                .ancestryOf(selected.path)
                .map((path) => controller.tree.byPath.get(path))
                .filter((node) => node !== undefined)}
              document={doc}
            />
          )
        }
      />
    </Box>
  );
}

/**
 * Names and patterns, never descriptions: typing `service` reaches every
 * application service in the design without a filter control beside the box.
 */
function OutlineSearchBox({ controller }: { controller: ModelTreeController }) {
  const { query, ask, search, tree, expandAll, collapseAll } = controller;
  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          size="sm"
          className={classes.search}
          value={query}
          onChange={(event) => ask(event.currentTarget.value)}
          aria-label="Search the outline"
          placeholder="Search names and patterns"
          leftSection={<IconSearch size={16} stroke={1.6} aria-hidden />}
          rightSection={
            query === '' ? null : (
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label="Clear the search"
                onClick={() => ask('')}
              >
                <IconX size={14} stroke={1.6} aria-hidden />
              </ActionIcon>
            )
          }
        />
        {/* Two buttons and not one switch: half a tree is open as often as
            not, and a switch would have to guess which way that counts. */}
        <ActionIcon
          variant="default"
          size="input-sm"
          aria-label="Expand everything"
          title="Expand everything"
          onClick={expandAll}
        >
          <IconFoldDown size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
        <ActionIcon
          variant="default"
          size="input-sm"
          aria-label="Collapse everything"
          title="Collapse everything"
          onClick={collapseAll}
        >
          <IconFoldUp size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
      </Group>
      {search.active && (
        <Text component="output" size="xs" c="dimmed">
          {`${search.matched.size} of ${tree.nodes.length} elements`}
        </Text>
      )}
    </Stack>
  );
}

function Outline({
  controller,
  empty,
}: {
  controller: ModelTreeController;
  empty: boolean;
}) {
  if (empty) return <Text c="dimmed">This design names no elements yet.</Text>;
  if (controller.search.active && controller.search.matched.size === 0) {
    return <Text c="dimmed">Nothing in this design is called that.</Text>;
  }
  return <ModelTree controller={controller} label="Design outline" />;
}

/** How the two columns were last left, which is not about any one document. */
const COLUMNS_KEY = 'noesis.designDocs.columns';
const DEFAULT_COLUMNS = [38, 62];
/** The width the shell folds its sidebar at, past which two columns fit. */
const WIDE = '(min-width: 62em)';

/**
 * A width left in storage by another version of the app must not decide how a
 * page is laid out, so anything that is not a pair of shares reads as the
 * default. Parsing is the one throwing call, and it is kept to this helper.
 */
function toColumns(stored: string | undefined): number[] {
  try {
    const parsed: unknown = stored === undefined ? null : JSON.parse(stored);
    const pair =
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_COLUMNS.length &&
      parsed.every(
        (share) => typeof share === 'number' && share > 0 && share < 100,
      );
    if (pair) return parsed as number[];
  } catch {
    // Unreadable is the same as absent.
  }
  return DEFAULT_COLUMNS;
}

/**
 * Side by side where there is room for it, and one under the other where
 * there is not: a phone has one column, and a splitter across it would only
 * be two things too narrow to read.
 */
function Columns({
  outline,
  detail,
}: {
  outline: ReactNode;
  detail: ReactNode;
}) {
  const wide = useMediaQuery(WIDE, true);
  const [columns, setColumns] = useLocalStorage<number[]>({
    key: COLUMNS_KEY,
    defaultValue: DEFAULT_COLUMNS,
    deserialize: toColumns,
    // Nothing renders on a server here, so the stored widths can be read
    // while the first paint is drawn rather than corrected after it.
    getInitialValueInEffect: false,
  });

  if (!wide) {
    return (
      <Stack gap="md" className={classes.stacked}>
        <Box className={classes.pane}>{outline}</Box>
        <Box className={classes.pane}>{detail}</Box>
      </Stack>
    );
  }

  return (
    <Splitter
      className={classes.columns}
      // The handle is a `separator` the reader can take with the keyboard, so
      // it needs a name of its own; Mantine gives it none.
      attributes={{ handle: { 'aria-label': 'Resize the columns' } }}
      sizes={columns}
      onSizeChange={(sizes) => setColumns(sizes.map(Number))}
    >
      <Splitter.Pane
        defaultSize={columns[0] ?? DEFAULT_COLUMNS[0]!}
        min="16rem"
        className={classes.pane}
      >
        {outline}
      </Splitter.Pane>
      <Splitter.Pane
        defaultSize={columns[1] ?? DEFAULT_COLUMNS[1]!}
        min="20rem"
        className={classes.pane}
      >
        {detail}
      </Splitter.Pane>
    </Splitter>
  );
}
