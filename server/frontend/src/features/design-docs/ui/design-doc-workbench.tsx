import { useCallback, useMemo } from 'react';
import { expansionMemory } from '#/features/design-docs/ui/model-tree/outline-memory.ts';
import { useFollowingTree } from '#/features/design-docs/ui/model-tree/use-following-tree.ts';
import {
  type DescriptionTarget,
  descriptionTargets,
} from '../design-doc-description.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { Columns } from './columns.tsx';
import { DesignDocOverview, OverviewLink } from './design-doc-overview.tsx';
import { ElementDetail } from './element-details/element-detail.tsx';
import { OutlineSearchBox } from './outline-search-box.tsx';
import { Outline } from './outline.tsx';
import type { ViewPlace } from './view-place.ts';

/*
 * The design read as what it designs: the model on the left, the element in
 * hand on the right. The document's own name heads the page it stands in; the
 * element's name heads the panel, so the outline of the page is the outline
 * of what is being read.
 *
 * Mount it under the document's id — every piece of state here is about the
 * document open, and opening another one starts again rather than carrying a
 * selection that names nothing.
 */
export function DesignDocWorkbench({
  detail,
  selected: addressed,
  query,
  onSelect,
  onQuery,
  onRequirement,
}: {
  detail: DesignDocDetail;
  /** Opens the requirements view on one of its entries. */
  onRequirement: (entry: string) => void;
} & ViewPlace) {
  const { document: doc, outline } = detail;
  const memory = useMemo(
    () => expansionMemory(`noesis.designDocs.${detail.document.id}.expanded`),
    [detail.document.id],
  );
  const { controller, outlineRef } = useFollowingTree(outline, {
    selected: addressed,
    onSelect,
    query,
    onQuery,
    memory,
    // The page opens on the overview, not on an element.
    opensAtTop: false,
  });
  const selected = controller.selectedNode;
  const { tree, select } = controller;
  const resolve = useMemo(
    () => descriptionTargets((path) => tree.byPath.has(path), doc),
    [tree, doc],
  );
  const selectFromDetail = useCallback(
    (path: string) => select(path, 'detail'),
    [select],
  );
  const open = useCallback(
    (target: DescriptionTarget) => {
      if (target.view === 'model') selectFromDetail(target.node);
      else onRequirement(target.entry);
    },
    [selectFromDetail, onRequirement],
  );
  // Nothing in hand is the overview, and leaves no row in the address.
  const openOverview = useCallback(() => onSelect('', 'detail'), [onSelect]);
  const selectedPath = useMemo(
    () =>
      selected === null
        ? []
        : tree
            .ancestryOf(selected.path)
            .map((path) => tree.byPath.get(path))
            .filter((node) => node !== undefined),
    [tree, selected],
  );

  return (
    <Columns
      search={<OutlineSearchBox controller={controller} />}
      outline={
        <>
          <OverviewLink active={selected === null} onOpen={openOverview} />
          <Outline controller={controller} />
        </>
      }
      outlineRef={outlineRef}
      detail={
        selected === null ? (
          <DesignDocOverview
            description={doc.description}
            resolve={resolve}
            onOpen={open}
          />
        ) : (
          <ElementDetail
            node={selected}
            path={selectedPath}
            document={doc}
            onSelect={selectFromDetail}
            tree={controller.tree}
          />
        )
      }
    />
  );
}
