import { useMemo } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { expansionMemory } from '#/shared/ui/model-tree/outline-memory.ts';
import { useFollowingTree } from '#/shared/ui/model-tree/use-following-tree.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { Columns } from './columns.tsx';
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
}: {
  detail: DesignDocDetail;
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
  });
  const selected = controller.selectedNode;
  const { tree } = controller;
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
      outline={<Outline controller={controller} />}
      outlineRef={outlineRef}
      detail={
        selected === null ? (
          <Text c="dimmed">Choose an element to read it.</Text>
        ) : (
          <ElementDetail
            node={selected}
            path={selectedPath}
            document={doc}
            onSelect={(path) => controller.select(path, 'detail')}
            tree={controller.tree}
          />
        )
      }
    />
  );
}
