import type { ReactNode } from 'react';
import { Grid } from '#/shared/design-system/grid.tsx';
import type { PartOwner } from '../../../../design-doc-edit.ts';
import { UnitActions } from '../../../unit-editor/unit-actions.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { DeclarationBox } from './declaration-box.tsx';

// Mantine asks for all five; past `md` the four columns hold.
const BREAKPOINTS = {
  xs: '440px',
  sm: '660px',
  md: '880px',
  lg: '1100px',
  xl: '1320px',
};
const SPAN = { base: 12, xs: 6, sm: 4, md: 3 };

/**
 * Boxes in as many columns as the panel has room for. Container breakpoints:
 * the columns follow the panel, not the window, keeping each box about
 * 200px wide as the panel grows.
 */
export function BoxGrid({
  cells,
}: {
  cells: { key: string; content: ReactNode }[];
}) {
  return (
    <Grid type="container" breakpoints={BREAKPOINTS} gap={10}>
      {cells.map(({ key, content }) => (
        <Grid.Col key={key} span={SPAN}>
          {content}
        </Grid.Col>
      ))}
    </Grid>
  );
}

/** Properties as the boxes inputs and outputs are drawn with. */
export function PropertyGrid({
  items,
  owner,
}: {
  items: ChangeListItem[];
  /** The block they are written in, which a write from a box names. */
  owner: PartOwner | null;
}) {
  return (
    <BoxGrid
      cells={items.map((item) => ({
        key: `${item.change}:${item.label}`,
        content: (
          <DeclarationBox
            item={item}
            typePath={item.typePath}
            actions={
              owner !== null &&
              item.key !== undefined && (
                <UnitActions unit={{ kind: 'property', id: item.key, owner }} />
              )
            }
          />
        ),
      }))}
    />
  );
}
