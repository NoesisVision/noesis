import { IconChevronRight } from '@tabler/icons-react';
import { Breadcrumbs } from '#/shared/design-system/breadcrumbs.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import classes from './element-detail.module.css';

/**
 * The path in words, under the rails that draw it: a reader who followed a
 * search result into the middle of a deep tree can still say where they are,
 * and can step back up it.
 *
 * A landmark, because that is what a trail is. The chevron between the steps
 * is hidden from assistive technology, where a reader who cannot see it is
 * not made to hear it; the element itself closes the trail as the current
 * location, not as a step of the way to it.
 */
export function DetailBreadcrumb({
  path,
  onSelect,
}: {
  path: readonly OutlineNode[];
  onSelect: (path: string) => void;
}) {
  if (path.length === 0) return null;
  const above = path.slice(0, -1);
  const lastItem = path[path.length - 1]!;
  return (
    <nav aria-label="Where this element sits" className={classes.breadcrumb}>
      <Breadcrumbs
        separator={
          <span className={classes.separator} aria-hidden="true">
            <IconChevronRight size={14} />
          </span>
        }
        separatorMargin={6}
      >
        {above.map((step) => (
          <UnstyledButton
            key={step.path}
            className={classes.step}
            onClick={() => onSelect(step.path)}
          >
            {step.name}
          </UnstyledButton>
        ))}
        <span className={classes.current} aria-current="location">
          {lastItem.name}
        </span>
      </Breadcrumbs>
    </nav>
  );
}
