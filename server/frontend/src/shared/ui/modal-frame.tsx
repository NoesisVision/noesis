import type { ReactNode } from 'react';
import { Breadcrumbs } from '#/shared/design-system/breadcrumbs.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Modal } from '#/shared/design-system/modal.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import classes from './modal-frame.module.css';

/**
 * Every modal of the app, drawn the same: a header with a tile for what the
 * modal is about, its title in bold and the close button, on one line; under
 * it, on a grey strip, the trail of what holds the subject; then the modal's
 * own body and footer (`ModalBody`, `ModalFooter`).
 *
 * The dialog is named by its title alone: the trail and a badge beside the
 * title are for the eye, hidden from assistive technology.
 */
export function ModalFrame({
  opened = true,
  onClose,
  icon,
  iconColor,
  title,
  badge,
  trail = [],
  size = 620,
  busy = false,
  children,
}: {
  opened?: boolean;
  onClose: () => void;
  /** The tile's icon: what the modal is about, or what it does. */
  icon: ReactNode;
  /** A colour of the theme for the tile; the brand's by default. */
  iconColor?: string;
  title: string;
  /** Beside the title, for the eye: a change badge, say. */
  badge?: ReactNode;
  /** What holds the modal's subject, from the top down; not the subject itself. */
  trail?: readonly string[];
  size?: number | string;
  /** While a save is on its way, the modal stays open. */
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      size={size}
      radius="lg"
      centered
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <Modal.Overlay />
      <Modal.Content shadow="xl">
        <Modal.Header className={classes.header}>
          <ThemeIcon
            size={44}
            radius="md"
            variant="light"
            color={iconColor}
            aria-hidden
          >
            {icon}
          </ThemeIcon>
          <Modal.Title className={classes.title}>
            {title}
            {badge !== undefined && <span aria-hidden="true">{badge}</span>}
          </Modal.Title>
          <Modal.CloseButton size="lg" disabled={busy} />
        </Modal.Header>
        {trail.length > 0 && (
          <Breadcrumbs
            className={classes.trail}
            separator="›"
            separatorMargin={6}
            aria-hidden
          >
            {trail.map((step, index) => (
              // A step's name may come twice down one trail.
              // oxlint-disable-next-line react/no-array-index-key
              <Text key={index} size="xs" c="dimmed">
                {step}
              </Text>
            ))}
          </Breadcrumbs>
        )}
        {children}
      </Modal.Content>
    </Modal.Root>
  );
}

/** A modal's content, with the same room on every side as its header. */
export function ModalBody({ children }: { children: ReactNode }) {
  return <div className={classes.body}>{children}</div>;
}

/**
 * A modal's footer, on grey: what the modal still needs, or nothing, on the
 * left; its buttons on the right, the one that acts last.
 */
export function ModalFooter({
  note,
  children,
}: {
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={classes.footer}>
      <Text size="xs" c="dimmed">
        {note}
      </Text>
      <Group gap="xs">{children}</Group>
    </div>
  );
}
