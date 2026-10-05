import { useMemo } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { Group } from '#/shared/design-system/group.tsx';
import { useElementSize } from '#/shared/design-system/hooks.ts';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById } from '../../change-set.ts';
import type { PartOwner, UnitRef } from '../../design-doc-edit.ts';
import { valueOf } from '../../design-doc-field.ts';
import { ownerOfPart } from '../../design-doc-outline.ts';
import { kindOf } from '../../element-id.ts';
import { UnitActions } from '../unit-editor/unit-actions.tsx';
import { bodySections } from './body/body-sections.tsx';
import { SCENARIO_COLUMN_ID, ScenarioColumn } from './body/scenario-column.tsx';
import { ScenarioFocusProvider } from './body/scenario-focus.tsx';
import { scenariosOf } from './body/scenarios-of.ts';
import { ChangeBadge } from './change-badge.tsx';
import { implementerItems, refItems } from './change-list-items.ts';
import { DesignDocumentContext } from './design-document-context.ts';
import { DetailBreadcrumb } from './detail-breadcrumb.tsx';
import { ElementColumns } from './element-columns.tsx';
import { ElementNavigationContext } from './element-navigation.ts';
import { ImplementedByModal } from './implemented-by-modal.tsx';
import { ImplementsLine } from './implements-line.tsx';
import { VisibilityBadge } from './visibility-badge.tsx';
import classes from './element-detail.module.css';

/*
 * One element of the design, read whole: where it sits, what it is, and what
 * the document says about it. The tree beside it says what changed; this says
 * what the thing is.
 */

export function ElementDetail({
  node,
  path,
  document: doc,
  onSelect,
  tree,
}: {
  node: OutlineNode;
  /** The line from the top of the tree down to the node, the node last. */
  path: readonly OutlineNode[];
  document: DesignDocumentInput;
  /** Takes the reader to another element, as the tree itself would. */
  onSelect: (path: string) => void;
  /** The tree beside the panel: what a section may open, and what changed under an element. */
  tree: OutlineTree;
}) {
  const navigation = useMemo(
    () => ({ has: (path: string) => tree.byPath.has(path), select: onSelect }),
    [tree, onSelect],
  );
  // Only a behaviour says who may call it.
  const visibility =
    node.kind === 'behaviour' && node.elementId
      ? valueOf(findById(doc.behaviours, node.elementId)?.visibility)
      : null;
  // Only a building block implements anything; it reads after its name.
  const implemented =
    node.kind === 'building_block' && node.elementId
      ? refItems(findById(doc.buildingBlocks, node.elementId)?.implements)
      : [];
  // And what implements it — found in the document even when it leaves the
  // block itself alone.
  const implementers =
    node.kind === 'building_block' && node.elementId
      ? implementerItems(doc, node.elementId)
      : [];
  // Scenarios read beside the sections, not as one more of them.
  const scenarios = scenariosOf(node, doc);
  // Measured outside the key below, so the width is known on every element.
  const { ref: bodyRef, width: bodyWidth } = useElementSize();
  return (
    <DesignDocumentContext.Provider value={doc}>
      <ElementNavigationContext.Provider value={navigation}>
        <DetailBreadcrumb path={path} onSelect={onSelect} />
        <header className={classes.header}>
          <span className={classes.tile}>
            <KindIcon kind={node.kind} pattern={node.pattern} />
          </span>
          <div className={classes.heading}>
            {/* What it is on the left, what the design does to it on the right. */}
            <div className={classes.kind}>
              {node.patternLabel !== null && (
                <span className={classes.pattern}>{node.patternLabel}</span>
              )}
              <Group gap="xs" ml="auto">
                <VisibilityBadge visibility={visibility} />
                <ChangeBadge change={node.change} />
                <ImplementedByModal items={implementers} />
                <NodeActions node={node} />
              </Group>
            </div>
            <div className={classes.title}>
              <Title order={2} className={classes.name}>
                {node.name}
              </Title>
              <ImplementsLine
                items={implemented}
                block={node.kind === 'building_block' ? node.elementId : null}
              />
            </div>
          </div>
        </header>
        <div ref={bodyRef} className={classes.body}>
          {/* Under the key, so every scenario is folded again on another element. */}
          <ScenarioFocusProvider key={node.path} scenarios={scenarios}>
            <ElementColumns
              width={bodyWidth}
              sections={bodySections(node, doc, tree)}
              scenarios={
                scenarios.length > 0 ? (
                  <ScenarioColumn
                    scenarios={scenarios}
                    id={SCENARIO_COLUMN_ID}
                    owner={partOwnerOf(node)}
                  />
                ) : null
              }
            />
          </ScenarioFocusProvider>
        </div>
      </ElementNavigationContext.Provider>
    </DesignDocumentContext.Provider>
  );
}

/**
 * The actions on the unit a row stands for: an element, or a property, rule
 * or scenario found through the element — and the rule — it is written in.
 * A row for anything else stands for no unit.
 */
function NodeActions({ node }: { node: OutlineNode }) {
  const unit = unitRefOf(node);
  return unit === null ? null : <UnitActions unit={unit} />;
}

function unitRefOf(node: OutlineNode): UnitRef | null {
  if (
    node.kind === 'module' ||
    node.kind === 'building_block' ||
    node.kind === 'behaviour'
  )
    return node.elementId === null
      ? null
      : { kind: node.kind, id: node.elementId };
  if (
    (node.kind !== 'property' &&
      node.kind !== 'rule' &&
      node.kind !== 'scenario') ||
    node.parentPath === null
  )
    return null;
  const { elementId, rule } = ownerOfPart(node.parentPath);
  return {
    kind: node.kind,
    id: node.name,
    owner: {
      kind: kindOf(elementId),
      id: elementId,
      ...(rule === null ? {} : { rule }),
    },
  };
}

/** The element a node's scenarios are written in, when it is one. */
function partOwnerOf(node: OutlineNode): PartOwner | undefined {
  const unit = unitRefOf(node);
  return unit === null || 'owner' in unit
    ? undefined
    : { kind: unit.kind as PartOwner['kind'], id: unit.id };
}
