import { useMemo } from 'react';
import { findById } from '#/features/design-docs/ui/element-details/change-set.ts';
import { Group } from '#/shared/design-system/group.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import { bodySections } from './body/body-sections.tsx';
import { ScenarioColumn } from './body/scenario-column.tsx';
import { scenariosOf } from './body/scenarios-of.ts';
import { ChangeBadge } from './change-badge.tsx';
import { DetailBreadcrumb } from './detail-breadcrumb.tsx';
import { ElementNavigationContext } from './element-navigation.ts';
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
  // Scenarios read beside the sections, not as one more of them.
  const scenarios = scenariosOf(node, doc);
  const withScenarios = scenarios.length > 0;
  return (
    <div>
      <DetailBreadcrumb path={path} onSelect={onSelect} />
      <header className={classes.header}>
        <span className={classes.tile}>
          <KindIcon kind={node.kind} pattern={node.pattern} />
        </span>
        <div className={classes.heading}>
          {node.patternLabel !== null && (
            <span className={classes.pattern}>{node.patternLabel}</span>
          )}
          <Title order={2} className={classes.name}>
            {node.name}
          </Title>
        </div>
        <Group gap="xs">
          <VisibilityBadge visibility={visibility} />
          <ChangeBadge change={node.change} size="sm" />
        </Group>
      </header>
      <ElementNavigationContext.Provider value={navigation}>
        {/* A container of its own: a grid cannot ask how wide it is itself. */}
        <div key={node.path} className={classes.body}>
          <div className={withScenarios ? classes.columns : undefined}>
            <div className={classes.sections}>
              {bodySections(node, doc, tree)}
            </div>
            {withScenarios && (
              <aside className={classes.aside}>
                <ScenarioColumn scenarios={scenarios} />
              </aside>
            )}
          </div>
        </div>
      </ElementNavigationContext.Provider>
    </div>
  );
}
