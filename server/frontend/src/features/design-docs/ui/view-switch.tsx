import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import type { DesignDocViewName } from '../design-docs.model.ts';

const VIEWS: { value: DesignDocViewName; label: string }[] = [
  { value: 'model', label: 'Model' },
  { value: 'requirements', label: 'Requirements' },
];

const isView = (value: string): value is DesignDocViewName =>
  VIEWS.some((view) => view.value === value);

/**
 * Which way the design document is read, in the header of either view: the
 * same control in the same place, so switching never moves it.
 */
export function ViewSwitch({
  view,
  onView,
}: {
  view: DesignDocViewName;
  onView: (view: DesignDocViewName) => void;
}) {
  return (
    <SegmentedControl
      aria-label="Read the design document as"
      value={view}
      data={VIEWS}
      onChange={(value) => {
        if (isView(value)) onView(value);
      }}
    />
  );
}
