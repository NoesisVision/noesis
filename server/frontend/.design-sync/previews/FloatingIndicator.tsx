import { Box, FloatingIndicator, Stack, Text } from '@noesis/design-system';
import { useState } from 'react';

const ENTRIES = [
  'A QDoc keeps at least one version',
  'Versions are numbered in order',
  'An archived QDoc takes no new version',
];

/** The entry in hand, under a card that slides to the next one picked. */
export const SelectedEntry = () => {
  const [parent, setParent] = useState<HTMLDivElement | null>(null);
  const [targets, setTargets] = useState<Record<number, HTMLElement | null>>(
    {},
  );
  const [active, setActive] = useState(0);
  return (
    <Box ref={setParent} pos="relative" w={420}>
      <Stack gap={0}>
        {ENTRIES.map((entry, index) => (
          <Box
            key={entry}
            ref={(node: HTMLDivElement | null) => {
              targets[index] = node;
              setTargets(targets);
            }}
            pos="relative"
            px="sm"
            py="md"
            style={{ zIndex: 1, cursor: 'pointer' }}
            onClick={() => setActive(index)}
          >
            <Text fw={600}>{entry}</Text>
          </Box>
        ))}
      </Stack>
      <FloatingIndicator
        target={targets[active]}
        parent={parent}
        style={{
          backgroundColor: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
          boxShadow: 'var(--mantine-shadow-sm)',
        }}
      />
    </Box>
  );
};
