import { IconX } from '@tabler/icons-react';
import { useId } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type {
  ElementSection,
  RelationKind,
} from '../../system-model-exploration.ts';
import { KindList } from './kind-list.tsx';
import { RelationList } from './relation-list.tsx';
import classes from './exploration.module.css';

/*
 * What the diagram lets the reader see, beside it while it is open: which
 * relations are drawn, and which kinds of element show. A kind hidden here
 * stays on the diagram, in its place, only out of sight with its edges.
 */
export function VisibilityPanel({
  relations,
  onRelations,
  sections,
  veiled,
  onVeil,
  onClose,
}: {
  relations: ReadonlySet<RelationKind>;
  onRelations: (relations: ReadonlySet<RelationKind>) => void;
  sections: ElementSection[];
  /** The kinds out of sight. */
  veiled: ReadonlySet<string>;
  onVeil: (veiled: ReadonlySet<string>) => void;
  onClose: () => void;
}) {
  const title = useId();
  return (
    <Box
      component="aside"
      aria-labelledby={title}
      className={`nowheel nopan ${classes.visibility}`}
      data-part="visibility"
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        gap="xs"
        px="sm"
        py={8}
        className={classes.visibilityHead}
      >
        <Title id={title} order={2} size="h5">
          Visibility
        </Title>
        <ActionIcon
          variant="subtle"
          aria-label="Close the visibility panel"
          onClick={onClose}
        >
          <IconX size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
      </Group>
      <RelationList shown={relations} onShow={onRelations} />
      <KindList sections={sections} hidden={veiled} onHide={onVeil} />
    </Box>
  );
}
