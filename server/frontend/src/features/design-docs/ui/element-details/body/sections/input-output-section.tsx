import { IconArrowsExchange } from '@tabler/icons-react';
import { useId } from 'react';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import type { ElementRef } from '../../element-ref.ts';
import { DeclarationBox } from './declaration-box.tsx';
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
 * in the order it declares them, a dashed seam, and what it returns, each a
 * `DeclarationBox` as a block's properties are.
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
          <DeclarationBox
            key={`${item.change}:${item.label}`}
            component="li"
            item={item}
            // A parameter's or a result's path is its type's own row.
            typePath={item.path}
            output={output}
          />
        ))}
      </ul>
    </div>
  );
}

/** Shown only when the design touches either side at all. */
InputOutputSection.shows = ({ input, output }: InputOutputSectionProps) =>
  input.length + output.length > 0;
