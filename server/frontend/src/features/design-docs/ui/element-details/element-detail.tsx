import { Fragment, useMemo } from 'react';
import { findById } from '#/features/design-docs/ui/element-details/change-set.ts';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import { bodySections } from './body-sections.tsx';
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
  return (
    <Stack gap="sm">
      <DetailBreadcrumb path={path} onSelect={onSelect} />
      <Box px="md">
        {(node.change !== 'unchanged' ||
          node.patternLabel !== null ||
          visibility !== null) && (
          <Group gap="xs" align="center" mb="xs">
            {node.patternLabel !== null && (
              <Badge size="xs" variant="default">
                {node.patternLabel}
              </Badge>
            )}
            <VisibilityBadge visibility={visibility} />
            <ChangeBadge change={node.change} />
          </Group>
        )}
        <Group gap="xs" align="center">
          <KindIcon kind={node.kind} pattern={node.pattern} />
          <Title order={2} size="h3" className={classes.name}>
            {node.name}
          </Title>
        </Group>
      </Box>
      <Divider />
      <ElementNavigationContext.Provider value={navigation}>
        <Fragment key={node.path}>
          {bodySections(node, doc, tree).map((section, index) => (
            <Fragment key={section.key}>
              {index > 0 && <Divider />}
              {section}
            </Fragment>
          ))}
        </Fragment>
      </ElementNavigationContext.Provider>
    </Stack>
  );
}
