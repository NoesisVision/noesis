import type { ReactElement } from 'react';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById, findByName } from '../../../change-set.ts';
import { ownerOfPart, partKeyOf } from '../../../design-doc-outline.ts';
import { relationsFrom } from '../../../relations.ts';
import type { OwnerRef } from '../element-ref.ts';
import {
  collaboratorSections,
  propertySections,
} from './property-sections.tsx';
import { ruleSections } from './rule-sections.tsx';
import { scenarioSections } from './scenario-sections.tsx';

/**
 * A property or collaborator, found through the block that owns it; a rule
 * or a scenario, by its id, shown under the element its row hangs under.
 */
export const partSections = (
  node: OutlineNode,
  doc: DesignDocumentInput,
): ReactElement[] => {
  if (node.parentPath === null) return [];
  const { elementId: ownerId, rule: ruleId } = ownerOfPart(node.parentPath);
  const block = findById(doc.buildingBlocks, ownerId);
  const behavior = block ? null : findById(doc.behaviors, ownerId);
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
  if (node.kind === 'rule') {
    const rule = findById(doc.rules, partKeyOf(node));
    return rule ? ruleSections(owner, rule, doc) : [];
  }
  const scenario = findById(doc.scenarios, partKeyOf(node));
  return scenario && ruleId !== null
    ? scenarioSections(owner, scenario, ruleId)
    : [];
};
