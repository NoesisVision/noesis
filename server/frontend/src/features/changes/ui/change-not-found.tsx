import { Link, useParams } from '@tanstack/react-router';
import { Button } from '#/shared/design-system/button';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { Title } from '#/shared/design-system/title';

export function ChangeNotFoundView() {
  const { changeId } = useParams({ strict: false });
  return (
    <Stack align="flex-start" gap="sm">
      <Title order={2}>Change not found</Title>
      <Text c="dimmed">
        There is no change "{changeId}" in this repository. Pick one from the
        sidebar, or go back to the last one you opened.
      </Text>
      <Button
        variant="default"
        renderRoot={(props) => <Link {...props} to="/" />}
      >
        Back
      </Button>
    </Stack>
  );
}
