import { useMemo } from 'react';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { TreeMoving } from '#/features/design-docs/ui/model-tree/model-tree.tsx';
import { expansionMemory } from '#/features/design-docs/ui/model-tree/outline-memory.ts';
import { useFollowingTree } from '#/features/design-docs/ui/model-tree/use-following-tree.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import {
  canMove,
  moveDestinationsOf,
  type UnitRef,
} from '../design-doc-edit.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { Columns } from './columns.tsx';
import { ElementDetail } from './element-details/element-detail.tsx';
import { OutlineSearchBox } from './outline-search-box.tsx';
import { Outline } from './outline.tsx';
import { AddUnitButton } from './unit-editor/unit-actions.tsx';
import { useUnitEditing } from './unit-editor/unit-editing.ts';
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

  const moving = useTreeMoving();

  return (
    <Columns
      search={
        <Stack gap="xs">
          <OutlineSearchBox controller={controller} />
          <AddUnitButton kind="module" style={{ alignSelf: 'flex-start' }} />
        </Stack>
      }
      outline={<Outline controller={controller} moving={moving} />}
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

/**
 * Dragging an element the design adds onto another parent, which asks where
 * it goes as the menu's "Move to…" does; nothing where the document is read
 * only.
 */
function useTreeMoving(): TreeMoving | undefined {
  const editing = useUnitEditing();
  return useMemo(() => {
    if (editing === null) return undefined;
    const { document: doc, move } = editing;
    const refOf = (node: OutlineNode): UnitRef | null =>
      node.elementId !== null &&
      (node.kind === 'module' ||
        node.kind === 'building_block' ||
        node.kind === 'behaviour')
        ? { kind: node.kind, id: node.elementId }
        : null;
    return {
      canMove: (node) => {
        const ref = refOf(node);
        return ref !== null && canMove(doc, ref);
      },
      canDrop: (node, onto) => {
        const ref = refOf(node);
        return (
          ref !== null &&
          onto.elementId !== null &&
          moveDestinationsOf(doc, ref).includes(onto.elementId)
        );
      },
      onDrop: (node, onto) => {
        const ref = refOf(node);
        if (ref !== null) move(ref, onto.elementId);
      },
    };
  }, [editing]);
}
