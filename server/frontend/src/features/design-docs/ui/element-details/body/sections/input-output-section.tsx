import { IconArrowsExchange } from '@tabler/icons-react';
import { useId } from 'react';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import type { PartOwner } from '../../../../design-doc-edit.ts';
import type { ChangeListItem } from '../../change-list-items.ts';
import { type ElementRef, partOwnerOf } from '../../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { WritableDeclarationBox } from './writable-declaration-box.tsx';
import canvas from './canvas.module.css';
import classes from './input-output-section.module.css';

interface InputOutputSectionProps {
  element: ElementRef;
  input: ChangeListItem[];
  output: ChangeListItem[];
}

/**
 * What a behavior takes and what it gives back, in three columns: its inputs
 * in the order it declares them, a dashed seam, and what it returns, each a
 * `DeclarationBox` as a block's properties are. Inputs that outgrow the
 * panel run on to the next row; the seam and the outputs stay beside them.
 */
export function InputOutputSection({
  element,
  input,
  output,
}: InputOutputSectionProps) {
  const owner = partOwnerOf(element);
  return (
    <DetailSection title="Input / Output" icon={<IconArrowsExchange />}>
      <Grid
        className={`${canvas.canvas} ${classes.flow}`}
        classNames={{ inner: classes.inner }}
      >
        <Grid.Col span={{ base: 'content' }} className={classes.inputs}>
          <Side label="Inputs" items={input} kind="parameter" owner={owner} />
        </Grid.Col>
        <Divider
          orientation="vertical"
          variant="dashed"
          className={classes.seam}
        />
        <Grid.Col span={{ base: 'content' }} className={classes.outputs}>
          <Side
            label="Outputs"
            items={output}
            kind="result"
            owner={owner}
            output
          />
        </Grid.Col>
      </Grid>
    </DetailSection>
  );
}

/** One column: its caption, with how many there are, over its boxes — inputs side by side, outputs one under another. */
function Side({
  label,
  items,
  kind,
  owner,
  output,
}: {
  label: string;
  items: ChangeListItem[];
  kind: 'parameter' | 'result';
  owner: PartOwner | null;
  output?: boolean;
}) {
  const caption = useId();
  return (
    <div className={classes.side}>
      <span id={caption} className={classes.caption}>
        {`${label} · ${items.length}`}
      </span>
      <ul
        aria-labelledby={caption}
        className={classes.list}
        data-output={output || undefined}
      >
        {items.map((item) => (
          <WritableDeclarationBox
            key={`${item.change}:${item.label}`}
            component="li"
            item={item}
            kind={kind}
            owner={owner}
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
