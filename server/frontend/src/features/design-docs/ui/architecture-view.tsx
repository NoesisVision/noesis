import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import type { OutlineKind } from '#/shared/ui/model-tree/model-outline.ts';
import {
  type ExpansionMemory,
  expansionMemory,
} from '#/shared/ui/model-tree/outline-memory.ts';
import { outlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import { revealRow } from '#/shared/ui/model-tree/reveal-row.ts';
import {
  type SelectSource,
  useModelTree,
} from '#/shared/ui/model-tree/use-model-tree.ts';
import {
  architectureTreeOf,
  defaultArchitectureExpansion,
} from '../architecture-tree.ts';
import { architectureOf } from '../design-doc-architecture.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { ArchitectureDetails } from './architecture-details.tsx';
import { ArchitectureDiagram } from './architecture-diagram.tsx';
import {
  elementSelection,
  focusOf,
  rowOf,
  subjectOf,
} from './architecture-selection.ts';
import { Columns } from './columns.tsx';
import { DesignDocSurface } from './design-doc-surface.tsx';
import { layoutArchitecture } from './layout-architecture.ts';
import { OutlineSearchBox } from './outline-search-box.tsx';
import { Outline } from './outline.tsx';
import type { ViewPlace } from './view-place.ts';

/*
 * The design read as hexagons: the checks and the needs at the ports as a
 * tree on the left with what the row in hand says under it, the hexagons on
 * the right. A row and a card are one selection — choosing either outlines
 * the cards it concerns and opens the tree to its row.
 *
 * Mount it under the document's id, as the other views are.
 */
export function ArchitectureView({
  detail,
  switcher,
  selected: addressed,
  query,
  onSelect,
  onQuery,
}: {
  detail: DesignDocDetail;
  /** The control that switches to another view, in the header as the others have it. */
  switcher?: ReactNode;
} & ViewPlace) {
  const doc = detail.document;
  const outline = useMemo(() => architectureOf(doc), [doc]);
  const nodes = useMemo(
    () =>
      architectureTreeOf(
        outline,
        new Set(doc.needs?.added?.map(({ id }) => id)),
      ),
    [outline, doc],
  );
  const layout = useMemo(() => layoutArchitecture(outline.hexagons), [outline]);
  const cards = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout],
  );
  const modelTree = useMemo(() => outlineTree(detail.outline), [detail]);
  const memory = useMemo(
    () =>
      withDefault(
        expansionMemory(`noesis.designDocs.${doc.id}.architecture.expanded`),
        () => defaultArchitectureExpansion(outline),
      ),
    [doc.id, outline],
  );

  const outlineBody = useRef<HTMLDivElement>(null);
  /* The row the reader picked in the tree, which the tree must not answer by
     scrolling: it is already under their eye. */
  const picked = useRef<string | null>(null);
  const onTreeSelect = useCallback(
    (path: string, source: SelectSource) => {
      if (source === 'tree') picked.current = path;
      onSelect(path, source);
    },
    [onSelect],
  );
  const controller = useModelTree(nodes, {
    selected: addressed,
    onSelect: onTreeSelect,
    query,
    onQuery,
    memory,
    excludeKinds: NO_KINDS,
    opensAtTop: false,
  });
  const at = controller.selected;
  useEffect(() => {
    const own = picked.current === at;
    picked.current = null;
    if (!own && at !== null) revealRow(outlineBody.current, at);
  }, [at]);

  const { tree, select } = controller;
  /** A card, or a link in the details: the first row naming it, else the element alone. */
  const selectElement = useCallback(
    (id: string) => {
      const row = rowOf(tree, id);
      if (row === null) onSelect(elementSelection(id), 'detail');
      else select(row.path, 'detail');
    },
    [tree, select, onSelect],
  );
  const subject = useMemo(
    () => subjectOf(addressed, tree, outline),
    [addressed, tree, outline],
  );
  const focus = useMemo(
    () => focusOf(subject, layout.nodes),
    [subject, layout],
  );

  return (
    <DesignDocSurface document={doc} switcher={switcher}>
      <Columns
        search={<OutlineSearchBox controller={controller} />}
        outline={
          <Outline
            controller={controller}
            empty={nodes.length === 0}
            label="Architecture outline"
          />
        }
        outlineRef={outlineBody}
        below={
          subject === null ? (
            <Text c="dimmed" size="sm" p="md">
              Choose a check, a need or a card to read it.
            </Text>
          ) : (
            <ArchitectureDetails
              subject={subject}
              outline={outline}
              document={doc}
              modelTree={modelTree}
              cards={cards}
              onSelectElement={selectElement}
              onClear={() => onSelect('', 'detail')}
            />
          )
        }
        detail={
          <ArchitectureDiagram
            outline={outline}
            layout={layout}
            focus={focus}
            onSelectElement={selectElement}
          />
        }
        detailFills
      />
    </DesignDocSurface>
  );
}

/** Checks and needs are the rows here, so the tree leaves nothing out. */
const NO_KINDS: readonly OutlineKind[] = [];

/** The memory, opening a tree it has never seen in the shape the view chooses. */
const withDefault = (
  memory: ExpansionMemory,
  shape: () => Set<string>,
): ExpansionMemory => ({
  recall: () => memory.recall() ?? shape(),
  remember: memory.remember,
});
