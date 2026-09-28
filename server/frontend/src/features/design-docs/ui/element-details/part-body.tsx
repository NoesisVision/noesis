import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById, findByName } from './change-set.ts';
import { PropertyBody } from './property-body.tsx';
import { RuleBody } from './rule-body.tsx';
import { ScenarioBody } from './scenario-body.tsx';

export function PartBody({
  node,
  document: doc,
}: {
  node: OutlineNode;
  document: DesignDocumentInput;
}) {
  const owner = node.parentPath;
  if (owner === null) return null;
  const parts =
    findById(doc.buildingBlocks, owner) ?? findById(doc.behaviours, owner);
  if (parts === null) return null;

  if (node.kind === 'property' && 'properties' in parts) {
    const property = findByName(parts.properties, node.name);
    return property ? <PropertyBody property={property} /> : null;
  }
  if (node.kind === 'rule') {
    const rule = findByName(parts.rules, node.name);
    return rule ? <RuleBody rule={rule} /> : null;
  }
  const scenario = findByName(parts.scenarios, node.name);
  return scenario ? <ScenarioBody scenario={scenario} /> : null;
}
