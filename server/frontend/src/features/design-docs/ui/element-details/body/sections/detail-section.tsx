import { IconSparkles, IconUser } from '@tabler/icons-react';
import { clsx } from 'clsx';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import {
  type DesignDocFieldInput,
  isHumanAuthored as humanAuthored,
} from '../../../../design-doc-field.ts';
import classes from './detail-section.module.css';

interface DetailSectionProps
  extends PropsWithChildren, ComponentProps<typeof Stack> {
  title?: string;
  /** Decorative, before the title: the title already says what it shows. */
  icon?: ReactNode;
  field?: DesignDocFieldInput<unknown>;
  /** Read last and quieter, under a rule: what is said about the element rather than what it is. */
  muted?: boolean;
}

export function DetailSection({
  title,
  icon,
  children,
  className,
  field,
  muted,
  ...props
}: DetailSectionProps) {
  const isHumanAuthored = field === undefined ? null : humanAuthored(field);
  return (
    <Stack
      component="section"
      gap={10}
      className={clsx(classes.root, muted && classes.muted, className)}
      {...props}
    >
      {/* A rule, not a border: the divider is the design system's. */}
      {muted && <Divider mb="xs" />}
      {!!title && (
        <div className={classes.title}>
          {icon && (
            <span className={classes.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {title}
          {isHumanAuthored !== null && (
            // Said in words, so it needs no name of its own.
            <span className={classes.author}>
              {isHumanAuthored ? (
                <IconUser size={14} aria-hidden />
              ) : (
                <IconSparkles size={14} aria-hidden />
              )}
              {isHumanAuthored ? 'Written by a human' : 'AI-generated'}
            </span>
          )}
        </div>
      )}
      <Box>{children}</Box>
    </Stack>
  );
}
