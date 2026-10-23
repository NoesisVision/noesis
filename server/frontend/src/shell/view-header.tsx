import { Box } from '#/shared/design-system/box.tsx';
import { PageHeading } from '#/shared/ui/page-heading.tsx';
import { useActiveRoute } from '#/shell/navigation/use-active-route.ts';

export function ViewHeader() {
  const { activeItem } = useActiveRoute();
  if (!activeItem) return null;

  return (
    <Box mb="lg">
      <PageHeading
        title={activeItem.label}
        eyebrow={activeItem.label}
        meta={activeItem.description}
        tone={activeItem.tone}
      />
    </Box>
  );
}
