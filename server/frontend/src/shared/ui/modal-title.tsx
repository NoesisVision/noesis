import type { ReactNode } from 'react';
import { Breadcrumbs } from '#/shared/design-system/breadcrumbs.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import classes from './modal-title.module.css';

/**
 * A modal's title under where it is about: the trail dimmed and only read —
 * it is no way out of the modal — then what the modal does, in bold. Only
 * the title names the dialog; the trail is hidden from assistive technology.
 */
export function ModalTitle({
  trail,
  children,
}: {
  /** The steps down to what the modal is about; none for no trail. */
  trail: readonly string[];
  children: ReactNode;
}) {
  return (
    <Stack component="span" gap={2}>
      {trail.length > 0 && (
        <Breadcrumbs
          component="span"
          // The dialog is named by its title alone: the trail is for the eye,
          // repeating where the page already says it is.
          aria-hidden
          separator={<span aria-hidden="true">&gt;</span>}
          separatorMargin={6}
          c="dimmed"
          fz="xs"
          fw={400}
          className={classes.trail}
        >
          {trail.map((step, index) => (
            // A step's name may come twice down one trail.
            // oxlint-disable-next-line react/no-array-index-key
            <Text key={index} span inherit>
              {step}
            </Text>
          ))}
        </Breadcrumbs>
      )}
      <Text span fz="xl" fw={700}>
        {children}
      </Text>
    </Stack>
  );
}
