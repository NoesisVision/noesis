import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { Panel } from '@xyflow/react';
import { useId, useState } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
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
  const [open, setOpen] = useState(false);
  const list = useId();
  if (entries.length === 0) return null;
  const Chevron = open ? IconChevronDown : IconChevronUp;
  return (
    <Panel position="bottom-right" className={classes.legend}>
      <UnstyledButton
        className={classes.legendToggle}
        aria-expanded={open}
        aria-controls={list}
        onClick={() => {
          setOpen(!open);
          onPick(null);
        }}
      >
        Legend
        <Chevron size={14} stroke={1.8} aria-hidden />
      </UnstyledButton>
      <ul id={list} hidden={!open} aria-label="Legend: pick out a kind of card">
        {entries.map(({ label, kinds }) => (
          <li key={label}>
            <UnstyledButton
              className={classes.legendEntry}
              aria-pressed={picked === label}
              onClick={() => onPick(picked === label ? null : label)}
            >
              {/* Marked with a kind it stands for, so it takes that kind's look. */}
              <span
                className={classes.swatch}
                data-kind={kinds[0]}
                aria-hidden
              />
              {label}
            </UnstyledButton>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
