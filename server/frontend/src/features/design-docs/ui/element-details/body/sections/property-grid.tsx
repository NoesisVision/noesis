import { Grid } from '#/shared/design-system/grid.tsx';
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

/** Properties as the boxes inputs and outputs are drawn with, in as many columns as the panel has room for. */
export function PropertyGrid({ items }: { items: ChangeListItem[] }) {
  return (
    // Container breakpoints: the columns follow the panel, not the window,
    // keeping each card about 200px wide as the panel grows.
    <Grid type="container" breakpoints={BREAKPOINTS} gap={10}>
      {items.map((item) => (
        <Grid.Col key={`${item.change}:${item.label}`} span={SPAN}>
          <DeclarationBox item={item} typePath={item.typePath} />
        </Grid.Col>
      ))}
    </Grid>
  );
}
