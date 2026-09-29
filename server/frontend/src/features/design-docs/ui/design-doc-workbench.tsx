import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import { useEffect, useMemo, useRef } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { useFullscreenElement } from '#/shared/design-system/hooks.ts';
import { Spoiler } from '#/shared/design-system/spoiler.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
import { expansionMemory } from '#/shared/ui/model-tree/outline-memory.ts';
import { revealRow } from '#/shared/ui/model-tree/reveal-row.ts';
import {
  type SelectSource,
  useModelTree,
} from '#/shared/ui/model-tree/use-model-tree.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DesignDocsIcon } from '../design-docs.model.ts';
import { Columns } from './columns.tsx';
import { ElementDetail } from './element-details/element-detail.tsx';
import { OutlineSearchBox } from './outline-search-box.tsx';
import { Outline } from './outline.tsx';
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
      {!!doc.description && (
        <Spoiler
          maxHeight={50}
          showLabel="Show more"
          hideLabel="Hide"
          c="dimmed"
        >
          {doc.description}
        </Spoiler>
      )}
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
              tree={controller.tree}
            />
          )
        }
      />
    </Box>
  );
}
