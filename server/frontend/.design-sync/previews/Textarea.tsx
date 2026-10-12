import { Stack, Textarea } from '@noesis/design-system';

export const MermaidSource = () => (
  <Stack gap="md" w={360}>
    <Textarea
      label="Diagram"
      autosize
      minRows={4}
      styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
      defaultValue={'stateDiagram-v2\n  Held --> Settled\n  Held --> Released'}
    />
  </Stack>
);

export const States = () => (
  <Stack gap="md" w={360}>
    <Textarea label="Statement" placeholder="What the stakeholder needs" />
    <Textarea label="Statement" defaultValue="" error="A new need has to say this." />
    <Textarea label="Statement" defaultValue="A guest wants the card held." disabled />
  </Stack>
);
