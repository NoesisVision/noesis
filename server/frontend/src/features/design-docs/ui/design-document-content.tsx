import { IconPencilBolt } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { DetailHeader } from '#/shared/ui/detail-header.tsx';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedPropertyInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';

/*
 * Renders the document as the diff it is: per kind of element, what the
 * design adds, modifies and removes. An element is shown by its address, the
 * part of its id after the kind; a field a human reviewed says so.
 */

interface ReviewableInput {
  value?: string | null | undefined;
  reviewedByHuman?: boolean | undefined;
}

interface ChangeSetInput<Item, Key> {
  added?: Item[] | undefined;
  removed?: Key[] | undefined;
  modified?: Item[] | undefined;
}

const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);
const humanType = (type: string | null | undefined) =>
  type?.replaceAll('_', ' ') ?? 'Unclassified';

function Field({
  field,
  fallback = 'Not specified.',
}: {
  field: ReviewableInput | undefined;
  fallback?: string;
}) {
  const value = field?.value ?? null;
  return (
    <>
      {value === null ? (
        <Text component="span" c="dimmed">
          {fallback}
        </Text>
      ) : (
        <Text component="span" style={{ whiteSpace: 'pre-wrap' }}>
          {value}
        </Text>
      )}
      {field?.reviewedByHuman && (
        <Badge size="xs" variant="light" ml="xs">
          reviewed
        </Badge>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section" withBorder padding="lg">
      <Stack gap="sm">
        <Title order={3}>{title}</Title>
        {children}
      </Stack>
    </Card>
  );
}

function Changes<Item, Key extends string>({
  set,
  keyOf,
  render,
}: {
  set: ChangeSetInput<Item, Key> | undefined;
  keyOf: (item: Item) => string;
  render: (item: Item) => ReactNode;
}) {
  const added = set?.added ?? [];
  const modified = set?.modified ?? [];
  const removed = set?.removed ?? [];
  if (!added.length && !modified.length && !removed.length) {
    return <Text c="dimmed">No changes.</Text>;
  }
  return (
    <Stack gap="sm">
      {added.map((item) => (
        <Card key={`added:${keyOf(item)}`} withBorder padding="sm">
          <Stack gap="xs">
            <Badge color="green" w="fit-content">
              added
            </Badge>
            {render(item)}
          </Stack>
        </Card>
      ))}
      {modified.map((item) => (
        <Card key={`modified:${keyOf(item)}`} withBorder padding="sm">
          <Stack gap="xs">
            <Badge color="blue" w="fit-content">
              modified
            </Badge>
            {render(item)}
          </Stack>
        </Card>
      ))}
      {removed.length > 0 && (
        <Card withBorder padding="sm">
          <Stack gap="xs">
            <Badge color="red" w="fit-content">
              removed
            </Badge>
            <ul>
              {removed.map((key) => (
                <li key={key}>
                  <code>{addressOf(key)}</code>
                </li>
              ))}
            </ul>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

/** A change set of parts, shown only when the design touches it. */
function Parts<Item extends { name: ReviewableInput }>({
  title,
  set,
  render,
}: {
  title: string;
  set: ChangeSetInput<Item, string> | undefined;
  render: (item: Item) => ReactNode;
}) {
  if (set === undefined) return null;
  return (
    <>
      <Title order={5}>{title}</Title>
      <Changes
        set={set}
        keyOf={(item) => item.name.value ?? ''}
        render={render}
      />
    </>
  );
}

function Strings({
  title,
  set,
}: {
  title: string;
  set: ChangeSetInput<string, string> | undefined;
}) {
  if (set === undefined) return null;
  return (
    <>
      <Title order={5}>{title}</Title>
      <Changes
        set={set}
        keyOf={(item) => item}
        render={(item) => <code>{addressOf(item)}</code>}
      />
    </>
  );
}

function Property({ property }: { property: DesignedPropertyInput }) {
  return (
    <Text>
      <code>
        <Field field={property.name} />:{' '}
        <Field field={property.type} fallback="?" />
        {property.collection ? '[]' : ''}
        {property.nullable ? ' | null' : ''}
      </code>
      {property.description?.value ? (
        <>
          {' — '}
          <Field field={property.description} />
        </>
      ) : null}
    </Text>
  );
}

function Rule({ rule }: { rule: DesignedRuleInput }) {
  return (
    <Stack gap={2}>
      <Group gap="xs">
        <Text fw={600} component="span">
          <Field field={rule.name} />
        </Text>
        {rule.ruleType && <Badge variant="outline">{rule.ruleType}</Badge>}
      </Group>
      <Text>
        <Field field={rule.description} />
      </Text>
    </Stack>
  );
}

function Scenario({ scenario }: { scenario: DesignedScenarioInput }) {
  return (
    <Stack gap={2}>
      <Text fw={600}>
        <Field field={scenario.name} />
      </Text>
      <Text>
        <Field field={scenario.description} />
      </Text>
      <Text>
        <strong>Given</strong> <Field field={scenario.given} />
      </Text>
      <Text>
        <strong>When</strong> <Field field={scenario.when} />
      </Text>
      <Text>
        <strong>Then</strong> <Field field={scenario.then} />
      </Text>
    </Stack>
  );
}

function Module({ module }: { module: DesignedDomainModuleInput }) {
  return (
    <Stack gap="xs">
      <Title order={4}>
        <code>{addressOf(module.id)}</code>
      </Title>
      <Text>
        <Field field={module.description} />
      </Text>
    </Stack>
  );
}

function BuildingBlock({ block }: { block: DesignedBuildingBlockInput }) {
  return (
    <Stack gap="xs">
      <Title order={4}>
        <code>{addressOf(block.id)}</code>
      </Title>
      <Text size="sm" c="dimmed">
        {humanType(block.type?.value)}
        {block.type?.reviewedByHuman && (
          <Badge size="xs" variant="light" ml="xs">
            reviewed
          </Badge>
        )}
      </Text>
      <Text>
        <Field field={block.description} />
      </Text>
      {block.implements && block.implements.length > 0 && (
        <Text>Implements: {block.implements.map(addressOf).join(', ')}</Text>
      )}
      <Parts
        title="Properties"
        set={block.properties}
        render={(property) => <Property property={property} />}
      />
      <Parts
        title="Rules"
        set={block.rules}
        render={(rule) => <Rule rule={rule} />}
      />
      <Parts
        title="Scenarios"
        set={block.scenarios}
        render={(scenario) => <Scenario scenario={scenario} />}
      />
    </Stack>
  );
}

function Behaviour({ behaviour }: { behaviour: DesignedBehaviourInput }) {
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Title order={4}>
          <code>{addressOf(behaviour.id)}</code>
        </Title>
        {behaviour.isPublic && <Badge variant="outline">public</Badge>}
      </Group>
      <Text size="sm" c="dimmed">
        {behaviour.type?.value ?? 'Unclassified'}
        {behaviour.actor?.value ? ` · ${behaviour.actor.value}` : ''}
      </Text>
      <Text>
        <Field field={behaviour.description} />
      </Text>
      <Strings title="Input" set={behaviour.input} />
      <Strings title="Output" set={behaviour.output} />
      <Strings title="Uses" set={behaviour.usedBuildingBlocks} />
      <Parts
        title="Rules"
        set={behaviour.rules}
        render={(rule) => <Rule rule={rule} />}
      />
      <Parts
        title="Scenarios"
        set={behaviour.scenarios}
        render={(scenario) => <Scenario scenario={scenario} />}
      />
    </Stack>
  );
}

export function DesignDocumentContent({
  document: doc,
}: {
  document: DesignDocumentInput;
}) {
  return (
    <Stack component="article" maw={1000}>
      <DetailHeader title={<Field field={doc.name} />} icon={IconPencilBolt} />
      <Text c="dimmed">{doc.implemented ? 'Implemented' : 'Draft'}</Text>
      <Text>
        <Field field={doc.description} />
      </Text>
      <Section title="Modules">
        <Changes
          set={doc.modules}
          keyOf={(module) => module.id}
          render={(module) => <Module module={module} />}
        />
      </Section>
      <Section title="Building blocks">
        <Changes
          set={doc.buildingBlocks}
          keyOf={(block) => block.id}
          render={(block) => <BuildingBlock block={block} />}
        />
      </Section>
      <Section title="Behaviours">
        <Changes
          set={doc.behaviours}
          keyOf={(behaviour) => behaviour.id}
          render={(behaviour) => <Behaviour behaviour={behaviour} />}
        />
      </Section>
    </Stack>
  );
}
