import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
} from '@noesis/design-system';

const noop = () => {};

export const DevToolsDialog = () => (
  <Modal
    opened
    onClose={noop}
    withinPortal={false}
    title="Dev tools"
    size="lg"
    yOffset={16}
    transitionProps={{ duration: 0 }}
  >
    <Stack gap="md" pt="xs">
      <Group justify="space-between">
        <div>
          <Text fw={600}>Show scanner provenance</Text>
          <Text size="sm" c="dimmed">
            Mark every element with the scanner that found it.
          </Text>
        </div>
        <Switch defaultChecked aria-label="Show scanner provenance" />
      </Group>
      <Group justify="space-between">
        <div>
          <Text fw={600}>Verbose behaviour logs</Text>
          <Text size="sm" c="dimmed">
            Log each behaviour's input and output to the console.
          </Text>
        </div>
        <Switch aria-label="Verbose behaviour logs" />
      </Group>
      <Group justify="flex-end" gap="sm">
        <Button variant="default">Reset</Button>
        <Button>Done</Button>
      </Group>
    </Stack>
  </Modal>
);
