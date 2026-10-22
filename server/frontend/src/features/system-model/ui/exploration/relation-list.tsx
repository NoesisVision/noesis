import { useId } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Checkbox } from '#/shared/design-system/checkbox.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import {
  RELATIONS,
  type RelationKind,
} from '../../system-model-exploration.ts';
import classes from './exploration.module.css';

/*
 * The relations the exploration draws, each a checkbox, all in sight. One
 * the scan holds nothing for stays in the list, switched off, and says so.
 */
export function RelationList({
  shown,
  onShow,
}: {
  shown: ReadonlySet<RelationKind>;
  onShow: (shown: ReadonlySet<RelationKind>) => void;
}) {
  const title = useId();
  return (
    <Box component="section" aria-labelledby={title}>
      <Text
        id={title}
        pt={6}
        px="sm"
        pb={8}
        fz="sm"
        fw={600}
        className={classes.head}
      >
        Relations
      </Text>
      <Stack gap={0} py={6}>
        {RELATIONS.map(({ kind, label }) => (
          <Checkbox
            key={kind}
            px="sm"
            py={7}
            size="xs"
            className={classes.row}
            label={label}
            checked={shown.has(kind)}
            onChange={(event) => {
              const next = new Set(shown);
              if (event.currentTarget.checked) next.add(kind);
              else next.delete(kind);
              onShow(next);
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}
