import {
  IconFoldDown,
  IconFoldUp,
  IconMaximize,
  IconMinimize,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from 'react';
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
import { ModelTree } from '#/shared/ui/model-tree/model-tree.tsx';
import { expansionMemory } from '#/shared/ui/model-tree/outline-memory.ts';
import { revealRow } from '#/shared/ui/model-tree/reveal-row.ts';
import {
  type ModelTreeController,
  type SelectSource,
  useModelTree,
} from '#/shared/ui/model-tree/use-model-tree.ts';
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
  onSelect: (path: string, source: SelectSource) => void;
  onQuery: (query: string) => void;
}) {
  const { document: doc, outline } = detail;
  const memory = useMemo(
    () => expansionMemory(`noesis.designDocs.${detail.document.id}.expanded`),
    [detail.document.id],
  );
  const outlineBody = useRef<HTMLDivElement>(null);
  /* The row the reader picked in the outline itself, which is the one move the
     outline must not answer by scrolling. */
  const picked = useRef<string | null>(null);
  const controller = useModelTree(outline, {
    selected: node,
    // Noted before the page is told, so that whatever the page does with the
    // move — navigating, rendering — the note is already there to be read.
    onSelect: (path, source) => {
      if (source === 'tree') picked.current = path;
      onSelect(path, source);
    },
    query,
    onQuery,
    memory,
  });
  /*
   * The outline follows the reading position, however it moved: a step of the
   * breadcrumb, the row the tree opened at, a link into the middle of a design,
   * Back or Forward. Watching where the reader is rather than listing the moves
   * that put them there is what makes the last two work — they change the
   * address and tell no one.
   *
   * The exception is a row clicked in the outline: it is already under the
   * reader's eye, and centring it would take the neighbours they were reading
   * out from under them. The note is cleared as it is read, so the same row
   * arrived at again — by Forward, say — is scrolled to like any other.
   */
  const at = controller.selected;
  useEffect(() => {
    const own = picked.current === at;
    picked.current = null;
    if (!own && at !== null) revealRow(outlineBody.current, at);
  }, [at]);
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
          title={doc.name}
          icon={DesignDocsIcon}
          description={detail.document.implemented ? 'Implemented' : 'Draft'}
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
        search={<OutlineSearchBox controller={controller} />}
        outline={
          <Outline controller={controller} empty={outline.length === 0} />
        }
        outlineRef={outlineBody}
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
              onSelect={(path) => controller.select(path, 'detail')}
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
  if (empty)
    return (
      <Box pt="md">
        <Text c="dimmed">This design names no elements yet.</Text>
      </Box>
    );
  if (controller.search.active && controller.search.matched.size === 0) {
    return (
      <Box pt="md">
        <Text c="dimmed">Nothing in this design is called that.</Text>
      </Box>
    );
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
 *
 * The search is a slot of its own rather than part of the outline, because the
 * pane is what decides that the bar stands still while the rows under it
 * scroll.
 */
function Columns({
  search,
  outline,
  outlineRef,
  detail,
}: {
  search: ReactNode;
  outline: ReactNode;
  /** The outline's scroller, for a page that has to bring a row into it. */
  outlineRef: RefObject<HTMLDivElement | null>;
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

  // One of the two branches renders, so the outline's scroller is one element.
  const outlinePane = (
    <>
      <Box className={classes.searchBar}>{search}</Box>
      <Box className={classes.outlineBody} ref={outlineRef}>
        {outline}
      </Box>
    </>
  );
  const detailPane = <Box className={classes.paneBody}>{detail}</Box>;

  if (!wide) {
    return (
      <Stack gap="md" className={classes.stacked}>
        <Box className={classes.pane}>{outlinePane}</Box>
        <Box className={classes.pane}>{detailPane}</Box>
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
        {outlinePane}
      </Splitter.Pane>
      <Splitter.Pane
        defaultSize={columns[1] ?? DEFAULT_COLUMNS[1]!}
        min="20rem"
        className={classes.pane}
      >
        {detailPane}
      </Splitter.Pane>
    </Splitter>
  );
}
