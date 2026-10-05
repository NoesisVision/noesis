import type { ReactNode } from 'react';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import classes from './architecture-details.module.css';

/** A paragraph of the details: at a reading measure, its line breaks kept. */
export function DetailText({ children }: { children: ReactNode }) {
  return (
    <Text fz="sm" maw="68ch" className={classes.text}>
      {children}
    </Text>
  );
}

/** A part of the details under an `h3`, quiet as the model's section titles are. */
export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Stack component="section" gap={6}>
      <Title order={3} size="sm" c="var(--noesis-secondary-text)">
        {title}
      </Title>
      {children}
    </Stack>
  );
}
