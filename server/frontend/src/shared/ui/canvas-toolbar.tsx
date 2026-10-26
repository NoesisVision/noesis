import { type Icon, IconChevronDown } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Popover } from '#/shared/design-system/popover.tsx';
import { Switch } from '#/shared/design-system/switch.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import classes from './canvas-toolbar.module.css';

/*
 * The row of controls over a diagram's canvas, the exploration's and the
 * architecture's alike: the controls from the left, in groups; how close the
 * canvas is, at the far end; under them, when there is one, a word on what
 * the canvas leaves out.
 */
export function CanvasToolbar({
  children,
  end,
  note,
}: {
  /** The controls, in groups, from the left. */
  children: ReactNode;
  /** At the far end: the zoom controls. */
  end?: ReactNode;
  /** A line under the controls, small and grey. */
  note?: ReactNode;
}) {
  return (
    <Box flex="none" className={classes.toolbar}>
      <Group justify="space-between" gap={12}>
        <Group gap={8}>{children}</Group>
        {/* At the far right, even when the row wraps and it goes under. */}
        {end !== undefined && <Box ml="auto">{end}</Box>}
      </Group>
      {note !== undefined && note !== null && (
        <Text fz="xs" mt={8} c="var(--noesis-secondary-text)">
          {note}
        </Text>
      )}
    </Box>
  );
}

/** A group of the toolbar's buttons on a soft grey pill of its own. */
export function ToolbarPill({ children }: { children: ReactNode }) {
  return (
    <Group gap={2} wrap="nowrap" className={classes.pill}>
      {children}
    </Group>
  );
}

/** A thin rule between the toolbar's groups of controls. */
export function ToolbarDivider() {
  return <Box className={classes.divider} aria-hidden />;
}

/** One way of drawing the canvas, on or off. */
export interface ToolbarOption {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/*
 * Ways of drawing the canvas, kept out of the row: a button saying how many
 * are on, opening onto a switch for each under a word on what they are.
 */
export function ToolbarOptions({
  label,
  icon: ButtonIcon,
  title,
  options,
}: {
  label: string;
  icon: Icon;
  /** Over the switches: what they are about. */
  title: string;
  options: ToolbarOption[];
}) {
  const on = options.filter(({ checked }) => checked).length;
  return (
    <Popover
      position="bottom-start"
      width={220}
      shadow="md"
      // The canvas stops a mouse press from reaching the page; a pointer's does.
      clickOutsideEvents={['pointerdown']}
    >
      <Popover.Target>
        <Button
          variant="subtle"
          color="gray"
          leftSection={<ButtonIcon size={16} stroke={1.6} aria-hidden />}
          rightSection={<IconChevronDown size={14} stroke={1.6} aria-hidden />}
        >
          {label}
          {on > 0 && (
            <Badge
              component="span"
              size="xs"
              variant="light"
              circle
              ml={6}
              aria-label={`${on} on`}
            >
              {on}
            </Badge>
          )}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="xs" fw={600} c="dimmed" mb="xs">
          {title}
        </Text>
        <Box className={classes.switches}>
          {options.map((option) => (
            <Switch
              key={option.label}
              size="sm"
              labelPosition="left"
              label={option.label}
              checked={option.checked}
              onChange={(event) => option.onChange(event.currentTarget.checked)}
            />
          ))}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
