import { type ReactNode, useMemo } from 'react';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type ArchitectureOutline,
  CHECK_LEVEL_META,
  placedById,
  RELATION_LABEL,
  TYPE_RELATIONS,
} from '../../architecture-outline.ts';
import { inferredFlowOf } from '../../design-doc-architecture.ts';
import { addressOf } from '../../element-id.ts';
import { DetailSection } from '../element-details/body/sections/detail-section.tsx';
import { ElementRelations } from '../element-details/element-relations.tsx';
import { InferredFlows } from './inferred-flows.tsx';
import type { LaidOutNode } from './layout-architecture.ts';
import classes from './architecture-details.module.css';

/** What the architecture finds about one element: its checks, its types, the flow its types suggest. */
export function ElementFindings({
  id,
  outline,
  document: doc,
  cards,
  modelTree,
}: {
  id: string;
  outline: ArchitectureOutline;
  document: DesignDocumentInput;
  cards: ReadonlyMap<string, LaidOutNode>;
  /** The model's own tree, where each type it speaks in finds its row. */
  modelTree: OutlineTree;
}) {
  const checks = outline.checks.filter(
    (check) =>
      check.level !== 'pass' && check.elementIds.some((one) => one === id),
  );
  const flows = useMemo(
    () => inferredFlowOf(doc, outline, id),
    [doc, outline, id],
  );
  // Not every element has a card of its own; the outline holds the rest.
  const element = cards.get(id)?.element ?? placedById(outline).get(id);
  const items = (blocks: readonly string[]) =>
    [...new Set(blocks)].map((block) => ({
      change: modelTree.byPath.get(block)?.change ?? 'unchanged',
      label: addressOf(block),
      path: block,
    }));
  const relations = [
    ...TYPE_RELATIONS.map((relation) => ({
      label: RELATION_LABEL[relation],
      items: items(
        (element?.typedWith ?? [])
          .filter((typed) => typed.relation === relation)
          .map(({ block }) => block),
      ),
    })),
    { label: RELATION_LABEL.uses, items: items(element?.uses ?? []) },
  ];
  return (
    <>
      {checks.length > 0 && (
        <DetailSection title="Checks" count={checks.length} order={3}>
          <Findings>
            {checks.map((check) => (
              <Finding key={check.id}>
                <Badge
                  color={CHECK_LEVEL_META[check.level].color}
                  variant="light"
                  size="sm"
                  tt="none"
                  flex="none"
                >
                  {CHECK_LEVEL_META[check.level].label}
                </Badge>
                <Text component="span" inherit>
                  {check.title}
                </Text>
              </Finding>
            ))}
          </Findings>
        </DetailSection>
      )}
      {/* As the model reads what a block implements: a box of type links. */}
      <ElementRelations relations={relations} tree={modelTree} flush />
      {flows.length > 0 && (
        <InferredFlows flows={flows} modelTree={modelTree} />
      )}
    </>
  );
}

/** A list of findings, one to a line. */
function Findings({ children }: { children: ReactNode }) {
  return (
    <Stack component="ul" gap={6} m={0} p={0} fz="sm" className={classes.list}>
      {children}
    </Stack>
  );
}

/** One finding: its mark, then what it says, on one baseline. */
function Finding({ children }: { children: ReactNode }) {
  return (
    <Group component="li" align="baseline" gap="xs" wrap="nowrap">
      {children}
    </Group>
  );
}
