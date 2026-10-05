import {
  Alert,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  Stack,
  Text,
} from '@noesis/design-system';

export const DiagramFailed = () => (
  <Alert color="red" title="Could not draw this diagram" maw={480}>
    <Text size="sm">Parse error on line 3: expected an arrow after "Checkout".</Text>
    <Text component="pre" size="sm" ff="monospace" m={0} mt="xs">
      {'flowchart LR\n  Checkout --> Payments\n  Checkout Orders'}
    </Text>
  </Alert>
);

export const Colors = () => (
  <Stack gap="sm" maw={480}>
    <Alert icon={<IconInfoCircle />} title="Scanner running">
      The repository scanner is reading payments-service. Elements will update
      when it finishes.
    </Alert>
    <Alert icon={<IconCircleCheck />} color="green" title="Change merged">
      Split order service is done; its design documents now describe the
      current architecture.
    </Alert>
    <Alert icon={<IconAlertTriangle />} color="yellow" title="Design drift">
      Three behaviours in the code no longer match the design document.
    </Alert>
  </Stack>
);

export const Variants = () => (
  <Stack gap="sm" maw={480}>
    <Alert variant="light" title="Light">
      No change is selected; edits go to the main design.
    </Alert>
    <Alert variant="filled" title="Filled">
      No change is selected; edits go to the main design.
    </Alert>
    <Alert variant="outline" title="Outline">
      No change is selected; edits go to the main design.
    </Alert>
  </Stack>
);

export const WithClose = () => (
  <Alert
    icon={<IconInfoCircle />}
    title="New scenarios available"
    withCloseButton
    closeButtonLabel="Dismiss"
    maw={480}
  >
    The agent proposed two scenarios for Refund a captured payment.
  </Alert>
);
