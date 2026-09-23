import { Box } from '#/shared/design-system/box.tsx';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
import { useActiveRoute } from '#/shell/navigation/use-active-route.ts';

export function ViewHeader() {
  const { activeItem } = useActiveRoute();
  if (!activeItem) return null;

  return (
    <Box mb="lg">
      <IconHeading
        title={activeItem.label}
        icon={activeItem.icon}
        description={activeItem.description}
      />
    </Box>
  );
}
