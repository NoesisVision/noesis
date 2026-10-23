import { IconChevronDown, type Icon } from '@tabler/icons-react';
import { type ReactNode, useId, useState } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Collapse } from '#/shared/design-system/collapse.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './canvas-legend.module.css';

/*
 * A key to a diagram in a corner of its canvas — what its keys do, what its
 * colours mean. It folds to its title, sliding shut, so it need not lie over
 * the cards for good; it starts folded.
 */
export function CanvasLegend({
  title,
  icon: TitleIcon,
  label,
  className,
  onOpenChange,
  children,
}: {
  title: string;
  icon: Icon;
  /** What it is called to a screen reader, when the title alone says less. */
  label?: string;
  /** Where it sits: its size and place are the canvas's to say. */
  className?: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const body = useId();
  return (
    <Box
      component="section"
      aria-label={label ?? title}
      className={`nowheel nopan ${classes.legend} ${className ?? ''}`}
    >
      <UnstyledButton
        className={classes.head}
        aria-expanded={open}
        aria-controls={body}
        onClick={() => {
          setOpen(!open);
          onOpenChange?.(!open);
        }}
      >
        <TitleIcon size={16} stroke={1.6} aria-hidden />
        <Text component="span" fz="xs" fw={600} flex={1}>
          {title}
        </Text>
        <IconChevronDown
          size={14}
          stroke={1.6}
          aria-hidden
          className={classes.chevron}
          data-open={open || undefined}
        />
      </UnstyledButton>
      <Collapse
        id={body}
        expanded={open}
        // Folded, its few lines stay in the page, only not shown.
        keepMountedMode="display-none"
      >
        <Box className={classes.body}>{children}</Box>
      </Collapse>
    </Box>
  );
}
