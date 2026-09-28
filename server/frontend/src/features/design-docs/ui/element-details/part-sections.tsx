import type { ReactElement } from 'react';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { ownerOfPart } from '../../design-doc-outline.ts';
import { findById, findByName } from './change-set.ts';
import type { OwnerRef } from './element-ref.ts';
import { propertySections } from './property-sections.tsx';
import { ruleSections } from './rule-sections.tsx';
import { scenarioSections } from './scenario-sections.tsx';

/**
 * A property, rule or scenario, found through the element that owns it — and
 * a rule's own scenario through that rule as well.
 */
export const partSections = (
  node: OutlineNode,
  doc: DesignDocumentInput,
): ReactElement[] => {
  if (node.parentPath === null) return [];
  const { elementId: ownerId, rule: ruleName } = ownerOfPart(node.parentPath);
  const block = findById(doc.buildingBlocks, ownerId);
  const behaviour = block ? null : findById(doc.behaviours, ownerId);
  const parts = block ?? behaviour;
  if (parts === null) return [];
  const owner: OwnerRef = {
    collection: block ? 'buildingBlocks' : 'behaviours',
    id: ownerId,
  };

  if (node.kind === 'property') {
    const property = block && findByName(block.properties, node.name);
    return property ? propertySections(owner, property) : [];
  }
  if (ruleName !== null) {
    const rule = findByName(parts.rules, ruleName);
    const scenario = rule && findByName(rule.scenarios, node.name);
    return scenario ? scenarioSections(owner, scenario, ruleName) : [];
  }
  if (node.kind === 'rule') {
    const rule = findByName(parts.rules, node.name);
    return rule ? ruleSections(owner, rule) : [];
  }
  const scenario = findByName(parts.scenarios, node.name);
  return scenario ? scenarioSections(owner, scenario) : [];
};
