import { Chip, Group, Stack, Text } from '@noesis/design-system';

/** One of a few: a behaviour's visibility, a rule's category. */
export const SingleChoice = () => (
  <Stack gap="md">
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        Visibility
      </Text>
      <Chip.Group defaultValue="public">
        <Group gap="xs" role="radiogroup" aria-label="Visibility">
          <Chip value="private" variant="outline">
            Private
          </Chip>
          <Chip value="public" variant="outline">
            Public
          </Chip>
        </Group>
      </Chip.Group>
    </Stack>
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        Category
      </Text>
      <Chip.Group defaultValue="Quality">
        <Group gap="xs" role="radiogroup" aria-label="Category">
          {['Business', 'Quality', 'Constraint'].map((category) => (
            <Chip key={category} value={category} variant="outline">
              {category}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Stack>
  </Stack>
);

/** Any of many: the needs a rule answers. */
export const ManyChoices = () => (
  <Stack gap={6} w={420}>
    <Text size="sm" fw={500}>
      Answers the needs
    </Text>
    <Chip.Group multiple defaultValue={['start-a-qdoc', 'ready-to-write']}>
      <Group gap="xs" role="group" aria-label="Answers the needs">
        <Chip value="start-a-qdoc" variant="outline">
          Start a QDoc
        </Chip>
        <Chip value="know-about-new-qdocs" variant="outline">
          Know about new QDocs
        </Chip>
        <Chip value="ready-to-write" variant="outline">
          Ready to write
        </Chip>
      </Group>
    </Chip.Group>
  </Stack>
);
