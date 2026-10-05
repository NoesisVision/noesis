import type { ReactNode } from 'react';
import { Blockquote } from '#/shared/design-system/blockquote.tsx';
import { Text } from '#/shared/design-system/text.tsx';

/** What a need or a rule says, set apart as a quotation of the design. */
export function Statement({ children }: { children: ReactNode }) {
  return (
    <Blockquote color="brand" radius="sm" mt="xs" py="xs" px="sm">
      {children}
    </Blockquote>
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
