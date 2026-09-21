import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Text } from '#/shared/design-system/text.tsx';

export function DesignDocsLoadError({ retry }: { retry: () => void }) {
  return (
    <Alert color="red" title="Could not load design docs">
      <Text>Please try again.</Text>
      <Button onClick={retry} mt="sm" variant="light">
        Retry
      </Button>
    </Alert>
  );
}
