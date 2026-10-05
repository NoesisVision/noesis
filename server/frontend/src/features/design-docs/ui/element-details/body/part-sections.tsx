import type { ReactElement } from 'react';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById, findByName } from '../../../change-set.ts';
import { ownerOfPart } from '../../../design-doc-outline.ts';
import type { OwnerRef } from '../element-ref.ts';
import { propertySections } from './property-sections.tsx';
import { ruleSections } from './rule-sections.tsx';
import { scenarioSections } from './scenario-sections.tsx';

/**
 * A property, rule or scenario, found through the element that owns it — and
 * a rule's own scenario through that rule as well. A module owns only rules.
 */
export const partSections = (
  node: OutlineNode,
  doc: DesignDocumentInput,
): ReactElement[] => {
  if (node.parentPath === null) return [];
  const { elementId: ownerId, rule: ruleName } = ownerOfPart(node.parentPath);
  const block = findById(doc.buildingBlocks, ownerId);
  const behaviour = block ? null : findById(doc.behaviours, ownerId);
  const module = block || behaviour ? null : findById(doc.modules, ownerId);
  const parts = block ?? behaviour ?? module;
  if (parts === null) return [];
  const owner: OwnerRef = {
    collection: block ? 'buildingBlocks' : behaviour ? 'behaviours' : 'modules',
    id: ownerId,
  };
  const scenarios = (block ?? behaviour)?.scenarios;

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
    return rule ? ruleSections(owner, rule, doc.needs) : [];
  }
  const scenario = findByName(scenarios, node.name);
  return scenario ? scenarioSections(owner, scenario) : [];
};
