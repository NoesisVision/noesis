import { Button, FileButton, Group, Text } from '@noesis/design-system';
import { useState } from 'react';

export const PickOne = () => {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Group gap="sm">
      <FileButton onChange={setFile} accept=".md,.txt">
        {(props) => (
          <Button {...props} variant="light">
            Attach a file
          </Button>
        )}
      </FileButton>
      <Text size="sm" c="dimmed">
        {file ? file.name : 'Nothing attached'}
      </Text>
    </Group>
  );
};

export const PickSeveral = () => (
  <FileButton onChange={() => {}} multiple>
    {(props) => (
      <Button {...props} variant="subtle" size="xs">
        Attach files
      </Button>
    )}
  </FileButton>
);
