import { useCallback, useMemo, useState } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { expansionMemory } from '#/shared/ui/model-tree/outline-memory.ts';
import { NO_KINDS, outlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import { useFollowingTree } from '#/shared/ui/model-tree/use-following-tree.ts';
import {
  architectureTreeOf,
  defaultArchitectureExpansion,
} from '../../architecture-tree.ts';
import {
  buildingBlockTypesOf,
  withoutTypes,
} from '../../building-block-types.ts';
import { architectureOf } from '../../design-doc-architecture.ts';
import type { DesignDocDetail } from '../../design-docs.api.ts';
import { Columns } from '../columns.tsx';
import { OutlineSearchBox } from '../outline-search-box.tsx';
import { Outline } from '../outline.tsx';
import type { ViewPlace } from '../view-place.ts';
import { ArchitectureDetails } from './architecture-details.tsx';
import { ArchitectureDiagram } from './architecture-diagram.tsx';
import {
  elementSelection,
  focusOf,
  rowOf,
  subjectOf,
} from './architecture-selection.ts';
import { layoutArchitecture } from './layout-architecture.ts';

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
  selected: addressed,
  query,
  onSelect,
  onQuery,
}: {
  detail: DesignDocDetail;
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
  /* Every card, drawn or not: the details read an element the reader has left
     out of the diagram as they read any other. */
  const cards = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout],
  );
  const types = useMemo(
    () => buildingBlockTypesOf(outline.hexagons),
    [outline],
  );
  /* A set of names kept for the tab, as the tree's open rows are. */
  const hiddenMemory = useMemo(
    () =>
      expansionMemory(`noesis.designDocs.${doc.id}.architecture.hiddenTypes`),
    [doc.id],
  );
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(
    () => hiddenMemory.recall() ?? new Set(),
  );
  const hideTypes = useCallback(
    (hidden: ReadonlySet<string>) => {
      setHiddenTypes(hidden);
      hiddenMemory.remember(hidden);
    },
    [hiddenMemory],
  );
  /* Laid out afresh without them, so a type left out leaves no gap behind;
     with none left out, it is the layout already made. */
  const drawn = useMemo(() => {
    const shown = withoutTypes(outline.hexagons, hiddenTypes);
    return shown === outline.hexagons ? layout : layoutArchitecture(shown);
  }, [outline, hiddenTypes, layout]);
  const modelTree = useMemo(() => outlineTree(detail.outline), [detail]);
  const memory = useMemo(
    () => expansionMemory(`noesis.designDocs.${doc.id}.architecture.expanded`),
    [doc.id],
  );

  // Checks and needs are the rows here, so the tree leaves nothing out.
  const { controller, outlineRef } = useFollowingTree(nodes, {
    selected: addressed,
    onSelect,
    query,
    onQuery,
    memory,
    excludeKinds: NO_KINDS,
    opensAtTop: false,
    opensOn: () => defaultArchitectureExpansion(outline),
  });

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
  const focus = useMemo(() => focusOf(subject, drawn.nodes), [subject, drawn]);

  return (
    <Columns
      search={<OutlineSearchBox controller={controller} counts="rows" />}
      outline={<Outline controller={controller} label="Architecture outline" />}
      outlineRef={outlineRef}
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
          layout={drawn}
          focus={focus}
          onSelectElement={selectElement}
          types={types}
          hiddenTypes={hiddenTypes}
          onHideTypes={hideTypes}
        />
      }
      detailFills
    />
  );
}
