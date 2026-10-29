import { Box } from '#/shared/design-system/box.tsx';
import { PageHeading } from '#/shared/ui/page-heading.tsx';
import { useActiveRoute } from '#/shell/navigation/use-active-route.ts';

/**
 * The heading of a view the navigation opens: its name as the title, and
 * over it the name again with what the view is for — or the title alone,
 * for a view whose title says enough.
 */
export function ViewHeader({ titleOnly = false }: { titleOnly?: boolean }) {
  const { activeItem } = useActiveRoute();
  if (!activeItem) return null;

  return (
    <Box mb="lg">
      <PageHeading
        title={activeItem.label}
        eyebrow={titleOnly ? undefined : activeItem.label}
        meta={titleOnly ? undefined : activeItem.description}
        tone={activeItem.tone}
      />
    </Box>
  );
}
