import type { ReactNode } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import classes from './architecture-details.module.css';

/** A paragraph of the details: at a reading measure, its line breaks kept. */
export function DetailText({ children }: { children: ReactNode }) {
  return (
    <Text fz="sm" maw="68ch" className={classes.text}>
      {children}
    </Text>
  );
}
