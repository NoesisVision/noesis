import type { ReactElement } from 'react';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById, findByName } from '../../../change-set.ts';
import { ownerOfPart } from '../../../design-doc-outline.ts';
import { relationsFrom } from '../../../relations.ts';
import type { OwnerRef } from '../element-ref.ts';
import {
  collaboratorSections,
  propertySections,
} from './property-sections.tsx';
import { ruleSections } from './rule-sections.tsx';
import { scenarioSections } from './scenario-sections.tsx';

/**
 * A property, collaborator, rule or scenario, found through the element that owns it — and
 * a rule's own scenario through that rule as well. A module owns only rules.
 */
export const partSections = (
  node: OutlineNode,
  doc: DesignDocumentInput,
): ReactElement[] => {
  if (node.parentPath === null) return [];
  const { elementId: ownerId, rule: ruleName } = ownerOfPart(node.parentPath);
  const block = findById(doc.buildingBlocks, ownerId);
  const behavior = block ? null : findById(doc.behaviors, ownerId);
  const module = block || behavior ? null : findById(doc.modules, ownerId);
  const owner: OwnerRef = {
    collection: block ? 'buildingBlocks' : behavior ? 'behaviors' : 'modules',
    id: ownerId,
  };

  // A property is a relation from its block, written whether or not the
  // document names the block itself.
  if (node.kind === 'property') {
    const property = findByName(
      relationsFrom(doc, 'property', ownerId),
      node.name,
    );
    return property ? propertySections(owner, property) : [];
  }
  if (node.kind === 'collaborator') {
    const collaborator = findByName(
      relationsFrom(doc, 'collaborator', ownerId),
      node.name,
    );
    return collaborator ? collaboratorSections(owner, collaborator) : [];
  }
  const parts = block ?? behavior ?? module;
  if (parts === null) return [];
  const scenarios = (block ?? behavior)?.scenarios;

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
