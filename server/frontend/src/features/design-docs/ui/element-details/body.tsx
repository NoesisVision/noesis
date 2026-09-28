import { Text } from '#/shared/design-system/text.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { BehaviourBody } from './behaviour-body.tsx';
import { BuildingBlockBody } from './building-block-body.tsx';
import { findById } from './change-set.ts';
import { ModuleBody } from './module-body.tsx';
import { PartBody } from './part-body.tsx';

export function Body({
  node,
  document: doc,
}: {
  node: OutlineNode;
  document: DesignDocumentInput;
}) {
  if (node.change === 'removed') {
    return (
      <Text c="dimmed">This design removes it. Nothing else is said.</Text>
    );
  }
  if (node.elementId === null) {
    return <PartBody node={node} document={doc} />;
  }
  const module = findById(doc.modules, node.elementId);
  if (module) return <ModuleBody module={module} />;
  const block = findById(doc.buildingBlocks, node.elementId);
  if (block) return <BuildingBlockBody block={block} />;
  const behaviour = findById(doc.behaviours, node.elementId);
  if (behaviour) return <BehaviourBody behaviour={behaviour} />;
  return (
    <Text c="dimmed">
      This design does not change it; it is here because the elements under it
      are.
    </Text>
  );
}
