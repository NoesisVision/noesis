import { IconChevronDown, type Icon } from '@tabler/icons-react';
import { type ReactNode, useId, useState } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Collapse } from '#/shared/design-system/collapse.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './canvas-legend.module.css';

/*
 * A key to a diagram in a corner of its canvas — what its keys do, what its
 * colours mean. It folds to its title, sliding shut, so it need not lie over
 * the cards for good; it starts folded. One whose icon says what it is alone
 * — a keyboard — folds further, to that icon: its title is then read only
 * while it is open, and said by a tooltip and to a screen reader while not.
 */
export function CanvasLegend({
  title,
  icon: TitleIcon,
  label,
  foldsToIcon = false,
  className,
  onOpenChange,
  children,
}: {
  title: string;
  icon: Icon;
  /** What it is called to a screen reader, when the title alone says less. */
  label?: string;
  /**
   * Folded, it is its icon alone, in a button of the icon's size. Its
   * canvas then says how wide it opens in `--legend-width`, which it widens
   * to as it slides open.
   */
  foldsToIcon?: boolean;
  /** Where it sits: its size and place are the canvas's to say. */
  className?: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const body = useId();
  const iconAlone = foldsToIcon && !open;
  return (
    <Box
      component="section"
      aria-label={label ?? title}
      className={`nowheel nopan ${classes.legend} ${className ?? ''}`}
      data-folds-to-icon={foldsToIcon || undefined}
      data-icon-alone={iconAlone || undefined}
    >
      {/*
        Its icon alone has no title beside it to read: the tooltip says it,
        beside the icon — a legend sits at its canvas's edge, where one
        above it would hang over that edge.
      */}
      <Tooltip
        label={title}
        disabled={!iconAlone}
        openDelay={300}
        position="right"
      >
        <UnstyledButton
          className={classes.head}
          aria-label={iconAlone ? title : undefined}
          aria-expanded={open}
          aria-controls={body}
          onClick={() => {
            setOpen(!open);
            onOpenChange?.(!open);
          }}
        >
          <TitleIcon size={16} stroke={1.6} aria-hidden />
          {!iconAlone && (
            <>
              <Text
                component="span"
                fz="xs"
                fw={600}
                flex={1}
                className={classes.title}
              >
                {title}
              </Text>
              <IconChevronDown
                size={14}
                stroke={1.6}
                aria-hidden
                className={classes.chevron}
                data-open={open || undefined}
              />
            </>
          )}
        </UnstyledButton>
      </Tooltip>
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
