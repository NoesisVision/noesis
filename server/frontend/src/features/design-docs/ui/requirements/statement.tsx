import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import classes from './requirements-view.module.css';

/** What a need or a rule says, set apart as a quotation of the design. */
export function Statement({ children }: { children: ReactNode }) {
  return (
    <Box
      component="blockquote"
      className={classes.quote}
      mt="xs"
      mb={0}
      mx={0}
      py="xs"
      px="sm"
      maw="70ch"
    >
      {children}
    </Box>
  );
}

/** A quieter line under a heading or a statement: who asks, what a section holds. */
export function Remark({ children }: { children: ReactNode }) {
  return (
    <Text mt="xs" fz="sm" c="var(--noesis-secondary-text)">
      {children}
    </Text>
  );
}
