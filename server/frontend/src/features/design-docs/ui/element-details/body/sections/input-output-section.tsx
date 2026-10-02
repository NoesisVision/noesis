import { IconArrowsExchange } from '@tabler/icons-react';
import { useId } from 'react';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import type { ElementRef } from '../../element-ref.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { DetailSection } from './detail-section.tsx';
import canvas from './canvas.module.css';
import classes from './input-output-section.module.css';

interface InputOutputSectionProps {
  element: ElementRef;
  input: ChangeListItem[];
  output: ChangeListItem[];
}

/**
 * What a behaviour takes and what it gives back, in three columns: its inputs
 * in the order it declares them, a dashed seam, and what it returns. A box
 * whose type has a row in the tree opens it.
 */
export function InputOutputSection({ input, output }: InputOutputSectionProps) {
  return (
    <DetailSection title="Input / Output" icon={<IconArrowsExchange />}>
      <Grid className={`${canvas.canvas} ${classes.flow}`}>
        <Grid.Col span={{ base: 'content' }}>
          <Side label="Inputs" items={input} />
        </Grid.Col>
        <Divider orientation="vertical" variant="dashed" />
        <Grid.Col span={{ base: 'content' }}>
          <Side label="Outputs" items={output} output />
        </Grid.Col>
      </Grid>
    </DetailSection>
  );
}

/** One column: its caption, with how many there are, over its boxes. */
function Side({
  label,
  items,
  output,
}: {
  label: string;
  items: ChangeListItem[];
  output?: boolean;
}) {
  const caption = useId();
  return (
    <div className={classes.side}>
      <span id={caption} className={classes.caption}>
        {`${label} · ${items.length}`}
      </span>
      <ul aria-labelledby={caption} className={classes.list}>
        {items.map((item) => (
          <Box
            key={`${item.change}:${item.label}`}
            item={item}
            output={output}
          />
        ))}
      </ul>
    </div>
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
      {type !== undefined && (
        <span
          className={name === undefined ? classes.name : classes.type}
          data-removed={removed}
        >
          <QualifiedName name={type} />
        </span>
      )}
      {description !== undefined && (
        <span className={classes.description}>{description}</span>
      )}
    </>
  );
  const box = (
    <li className={classes.box} data-output={output || undefined}>
      {path !== null && has(path) ? (
        <UnstyledButton className={classes.open} onClick={() => select(path)}>
          {lines}
        </UnstyledButton>
      ) : (
        lines
      )}
    </li>
  );
  // The whole box says what its type is, not only the word that names it.
  return type === undefined ? (
    box
  ) : (
    <ElementTooltip name={type}>{box}</ElementTooltip>
  );
}

/** Shown only when the design touches either side at all. */
InputOutputSection.shows = ({ input, output }: InputOutputSectionProps) =>
  input.length + output.length > 0;
