import { IconArrowsExchange } from '@tabler/icons-react';
import { useId } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import type { ElementRef } from '../../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { shortName } from './ref.tsx';
import canvas from './canvas.module.css';
import classes from './input-output-section.module.css';

interface InputOutputSectionProps {
  element: ElementRef;
  input: ChangeListItem[];
  output: ChangeListItem[];
}

/**
 * What a behaviour takes and what it gives back, drawn as a flow: its inputs
 * stacked on the left in the order it declares them, what it returns on the
 * right. A box whose type has a row in the tree opens it.
 */
export function InputOutputSection({ input, output }: InputOutputSectionProps) {
  const inputs = useId();
  const outputs = useId();
  return (
    <DetailSection title="Input / Output" icon={<IconArrowsExchange />}>
      <div className={`${canvas.canvas} ${classes.flow}`}>
        <span id={inputs} className={classes.caption}>
          Inputs · {input.length}
        </span>
        <span id={outputs} className={`${classes.caption} ${classes.right}`}>
          {output.length > 1 ? `Outputs · ${output.length}` : 'Output'}
        </span>
        <ul aria-labelledby={inputs} className={classes.side}>
          {input.map((item) => (
            <Box key={`${item.change}:${item.label}`} item={item} />
          ))}
        </ul>
        <span className={classes.divider} aria-hidden="true" />
        <ul
          aria-labelledby={outputs}
          className={`${classes.side} ${classes.right}`}
        >
          {output.map((item) => (
            <Box key={`${item.change}:${item.label}`} item={item} output />
          ))}
        </ul>
      </div>
    </DetailSection>
  );
}

/** One parameter or result: its name, if it has one, over its type. */
function Box({ item, output }: { item: ChangeListItem; output?: boolean }) {
  const { has, select } = useElementNavigation();
  const { change, path, name, type, description } = item;
  const removed = change === 'removed' || undefined;
  const lines = (
    <>
      {name !== undefined && (
        <span className={classes.name} data-removed={removed}>
          {name}
        </span>
      )}
      {/* Read by its last segment, as the tree names it; in full on hover. */}
      {type !== undefined && (
        <span
          className={name === undefined ? classes.name : classes.type}
          data-removed={removed}
        >
          {shortName(type).type}
        </span>
      )}
      {description !== undefined && (
        <span className={classes.description}>{description}</span>
      )}
    </>
  );
  return (
    <li className={classes.box} data-output={output || undefined} title={type}>
      {path !== null && has(path) ? (
        <UnstyledButton className={classes.open} onClick={() => select(path)}>
          {lines}
        </UnstyledButton>
      ) : (
        lines
      )}
    </li>
  );
}

/** Shown only when the design touches either side at all. */
InputOutputSection.shows = ({ input, output }: InputOutputSectionProps) =>
  input.length + output.length > 0;
