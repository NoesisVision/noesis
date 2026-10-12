import { Group } from '#/shared/design-system/group.tsx';
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { titleCase } from '#/shared/ui/title-case.ts';
import {
  DESIGN_DOC_VIEW_ICONS,
  DESIGN_DOC_VIEWS,
  type DesignDocViewName,
  isDesignDocView,
} from '../design-docs.model.ts';

/** Each view by its icon and its name, written out. */
const VIEWS = DESIGN_DOC_VIEWS.map((value) => {
  const Icon = DESIGN_DOC_VIEW_ICONS[value];
  return {
    value,
    label: (
      <Group gap={6} wrap="nowrap">
        <Icon size={16} stroke={1.6} aria-hidden />
        {titleCase(value)}
      </Group>
    ),
  };
});

/**
 * Which way the design document is read, in the header of every view: the
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
        if (isDesignDocView(value)) onView(value);
      }}
    />
  );
}
