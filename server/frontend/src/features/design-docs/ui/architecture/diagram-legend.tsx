import { IconHexagons } from '@tabler/icons-react';
import { Panel } from '@xyflow/react';
import { Box } from '#/shared/design-system/box.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { CanvasLegend } from '#/shared/ui/canvas-legend.tsx';
import type { LegendEntry } from './architecture-kinds.ts';
import classes from './architecture-diagram.module.css';

/*
 * The legend floats over the canvas, still while it pans and zooms. Each
 * entry is a toggle: pressed, it picks out the cards of its kind and fades
 * the rest; pressed again, every card is alike. Folded away, it is only its
 * title, and nothing stays picked out that the reader cannot see the reason for.
 */
export function Legend({
  entries,
  picked,
  onPick,
}: {
  entries: LegendEntry[];
  picked: string | null;
  onPick: (label: string | null) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <Panel position="bottom-left">
      <CanvasLegend
        title="Legend"
        icon={IconHexagons}
        label="Legend: the kinds of card"
        className={classes.legend}
        onOpenChange={() => onPick(null)}
      >
        <Stack
          component="ul"
          aria-label="Legend: pick out a kind of card"
          gap={2}
          m={0}
          p={0}
          className={classes.legendList}
        >
          {entries.map(({ label, kinds }) => (
            <Box component="li" key={label}>
              <UnstyledButton
                className={classes.legendEntry}
                aria-pressed={picked === label}
                onClick={() => onPick(picked === label ? null : label)}
              >
                {/* Marked with a kind it stands for, so it takes that kind's look. */}
                <Box
                  component="span"
                  className={classes.swatch}
                  data-kind={kinds[0]}
                  aria-hidden
                />
                {label}
              </UnstyledButton>
            </Box>
          ))}
        </Stack>
      </CanvasLegend>
    </Panel>
  );
}
