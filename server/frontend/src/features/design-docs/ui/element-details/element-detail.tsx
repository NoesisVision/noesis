import { useMemo } from 'react';
import { Group } from '#/shared/design-system/group.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById } from '../../change-set.ts';
import { valueOf } from '../../design-doc-field.ts';
import { bodySections } from './body/body-sections.tsx';
import { SCENARIO_COLUMN_ID, ScenarioColumn } from './body/scenario-column.tsx';
import { ScenarioFocusProvider } from './body/scenario-focus.tsx';
import { scenariosOf } from './body/scenarios-of.ts';
import { ChangeBadge } from './change-badge.tsx';
import { implementerItems, refItems } from './change-list-items.ts';
import { DesignDocumentContext } from './design-document-context.ts';
import { DetailBreadcrumb } from './detail-breadcrumb.tsx';
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
  const withScenarios = scenarios.length > 0;
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
              </Group>
            </div>
            <div className={classes.title}>
              <Title order={2} className={classes.name}>
                {node.name}
              </Title>
              <ImplementsLine items={implemented} />
            </div>
          </div>
        </header>
        {/* A container of its own: a grid cannot ask how wide it is itself. */}
        <div key={node.path} className={classes.body}>
          {/* Under the key, so every scenario is folded again on another element. */}
          <ScenarioFocusProvider scenarios={scenarios}>
            <div className={withScenarios ? classes.columns : undefined}>
              <div className={classes.sections}>
                {bodySections(node, doc, tree)}
              </div>
              {withScenarios && (
                <aside className={classes.aside}>
                  <ScenarioColumn
                    scenarios={scenarios}
                    id={SCENARIO_COLUMN_ID}
                  />
                </aside>
              )}
            </div>
          </ScenarioFocusProvider>
        </div>
      </ElementNavigationContext.Provider>
    </DesignDocumentContext.Provider>
  );
}
