import { Button, Stack, Text, Title } from '@mantine/core';
import { Link, useParams } from '@tanstack/react-router';

/** Rendered inside the shell when the URL names a change that does not exist. */
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
