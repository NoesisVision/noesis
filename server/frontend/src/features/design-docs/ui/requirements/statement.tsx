import type { ReactNode } from 'react';
import { Text } from '#/shared/design-system/text.tsx';

/** A quieter line under a heading or a statement: who asks, what a section holds. */
export function Remark({ children }: { children: ReactNode }) {
  return (
    <Text mt="xs" fz="sm" c="var(--noesis-secondary-text)">
      {children}
    </Text>
  );
}
