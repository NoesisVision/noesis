import { IconChevronRight } from '@tabler/icons-react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Breadcrumbs } from '#/shared/design-system/breadcrumbs.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './detail-breadcrumb.module.css';

/**
 * The path in words, under the rails that draw it: a reader who followed a
 * search result into the middle of a deep tree can still say where they are,
 * and can step back up it. Each step carries its kind's icon, as its row does.
 *
 * A landmark, because that is what a trail is. The separator between the
 * steps is hidden from assistive technology, where a reader who cannot see it
 * is not made to hear it; the element itself closes the trail as the current
 * location, not as a step of the way to it.
 */
export function DetailBreadcrumb({
  path,
  onSelect,
}: {
  path: readonly OutlineNode[];
  onSelect: (path: string) => void;
}) {
  const above = path.slice(0, -1);
  if (path.length === 0) return null;
  const lastItem = path[path.length - 1];
  return (
    <Box
      component="nav"
      aria-label="Where this element sits"
      className={classes.trail}
    >
      <Breadcrumbs
        separator={
          <span aria-hidden="true">
            <IconChevronRight size={12} />
          </span>
        }
        separatorMargin={2}
        className={classes.crumbs}
      >
        {above.map((step) => (
          <UnstyledButton
            key={step.path}
            className={classes.crumb}
            title={`Go to ${step.name}`}
            onClick={() => onSelect(step.path)}
          >
            <KindIcon kind={step.kind} pattern={step.pattern} size={14} />
            <span>{step.name}</span>
          </UnstyledButton>
        ))}
        {lastItem ? (
          <span className={classes.crumb} data-current>
            <KindIcon
              kind={lastItem.kind}
              pattern={lastItem.pattern}
              size={14}
            />
            <span aria-current="location">{lastItem.name}</span>
          </span>
        ) : null}
      </Breadcrumbs>
    </Box>
  );
}
