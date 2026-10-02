import { Accordion, Badge, Group, Text } from '@noesis/design-system';

export const Scenarios = () => (
  <Accordion
    multiple
    variant="separated"
    chevronPosition="right"
    defaultValue={['0']}
    maw={600}
  >
    <Accordion.Item value="0">
      <Accordion.Control>
        <Group gap="xs" wrap="nowrap" component="span">
          <Text component="span" size="sm">
            Refund a captured payment
          </Text>
          <Badge component="span" color="green" variant="light" size="xs">
            added
          </Badge>
          <Text component="span" size="xs" c="dimmed">
            Refunds stay within the captured amount
          </Text>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Text size="sm" c="dimmed">
          Given a captured payment of 40 EUR, when support refunds 15 EUR, the
          order shows a partial refund and 25 EUR remains refundable.
        </Text>
      </Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="1">
      <Accordion.Control>
        <Group gap="xs" wrap="nowrap" component="span">
          <Text component="span" size="sm">
            Retry a declined card
          </Text>
          <Badge component="span" color="cyan" variant="light" size="xs">
            modified
          </Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Text size="sm" c="dimmed">
          The checkout retries twice with backoff before asking for another
          card.
        </Text>
      </Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="2">
      <Accordion.Control>
        <Group gap="xs" wrap="nowrap" component="span">
          <Text component="span" size="sm" td="line-through">
            Pay by bank transfer
          </Text>
          <Badge component="span" color="red" variant="light" size="xs">
            removed
          </Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Text c="dimmed" size="sm">
          This design removes it.
        </Text>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion>
);

const sections = [
  {
    value: 'scanners',
    title: 'Scanners',
    body: 'Scanners read the repositories and turn source code into elements of the knowledge graph.',
  },
  {
    value: 'documents',
    title: 'Design documents',
    body: 'A design document describes the intended shape of a part of the system before it is built.',
  },
  {
    value: 'changes',
    title: 'Changes',
    body: 'A change groups the design documents and code that move the architecture from one state to the next.',
  },
];

const Items = () =>
  sections.map((section) => (
    <Accordion.Item key={section.value} value={section.value}>
      <Accordion.Control>{section.title}</Accordion.Control>
      <Accordion.Panel>
        <Text size="sm">{section.body}</Text>
      </Accordion.Panel>
    </Accordion.Item>
  ));

export const Default = () => (
  <Accordion defaultValue="scanners" maw={420}>
    <Items />
  </Accordion>
);

export const Contained = () => (
  <Accordion variant="contained" defaultValue="documents" maw={420}>
    <Items />
  </Accordion>
);

export const Filled = () => (
  <Accordion variant="filled" defaultValue="changes" maw={420}>
    <Items />
  </Accordion>
);
