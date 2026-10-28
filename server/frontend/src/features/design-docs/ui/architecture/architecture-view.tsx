import { useCallback, useMemo, useState } from 'react';
import { expansionMemory } from '#/features/design-docs/ui/model-tree/outline-memory.ts';
import {
  NO_KINDS,
  outlineTree,
} from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { useFollowingTree } from '#/features/design-docs/ui/model-tree/use-following-tree.ts';
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
import { DesignDocumentContext } from '../element-details/design-document-context.ts';
import { OutlineSearchBox } from '../outline-search-box.tsx';
import { Outline } from '../outline.tsx';
import type { ViewPlace } from '../view-place.ts';
import {
  ArchitectureDetails,
  type ArchitectureDetailsProps,
  subjectTitleOf,
} from './architecture-details.tsx';
import { ArchitectureDiagram } from './architecture-diagram.tsx';
import {
  elementSelection,
  focusOf,
  rowOf,
  subjectOf,
} from './architecture-selection.ts';
import { DetailsDock } from './details-dock.tsx';
import { layoutArchitecture } from './layout-architecture.ts';

/*
 * The design read as hexagons: the checks and the needs at the ports as a
 * tree on the left, the hexagons on the right. A row and a card are one
 * selection — choosing either outlines the cards it concerns, opens the tree
 * to its row, and reads it in a panel on the canvas, beside those cards.
 * What an element is shows on hover over its card, as the model's tooltips
 * say it; the diagram reads with the document at hand for them.
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
  // The details minimized: shrunk into their corner, where a button opens
  // them again. Kept so as the selection changes.
  const [folded, setFolded] = useState(false);
  const details: ArchitectureDetailsProps | null =
    subject === null
      ? null
      : {
          subject,
          outline,
          document: doc,
          modelTree,
          cards,
          onSelectElement: selectElement,
          // No close button: the selection is let go of on the canvas, by a
          // click on it or Escape, as on the exploration.
          onMinimize: () => setFolded(true),
          glance: true,
        };
  return (
    <DesignDocumentContext.Provider value={doc}>
      <Columns
        search={<OutlineSearchBox controller={controller} counts="rows" />}
        outline={
          <Outline controller={controller} label="Architecture outline" />
        }
        outlineRef={outlineRef}
        detail={
          <ArchitectureDiagram
            outline={outline}
            layout={drawn}
            focus={focus}
            onSelectElement={selectElement}
            onClear={
              subject === null ? undefined : () => onSelect('', 'detail')
            }
            selection={
              details === null ? null : (
                <DetailsDock
                  folded={folded}
                  onUnfold={() => setFolded(false)}
                  subject={subjectTitleOf(details)}
                >
                  <ArchitectureDetails {...details} />
                </DetailsDock>
              )
            }
            types={types}
            hiddenTypes={hiddenTypes}
            onHideTypes={hideTypes}
          />
        }
        detailFills
      />
    </DesignDocumentContext.Provider>
  );
}
