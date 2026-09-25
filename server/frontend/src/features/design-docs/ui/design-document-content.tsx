import type { ReactNode } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { ReadingPane } from '#/shared/ui/reading-pane.tsx';
import type { DesignDocFieldAuthor } from '#backend/app/design-docs/design-doc-field.ts';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedPropertyInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import { DesignDocsIcon } from '../design-docs.model.ts';

/*
 * Renders the document as the diff it is: per kind of element, what the
 * design adds, modifies and removes. An element is shown by its address, the
 * part of its id after the kind; a field a human wrote or accepted says so.
 */

type DesignDocFieldInput<T> =
  | {
      changed?: true | undefined;
      value: T;
      author?: DesignDocFieldAuthor | undefined;
    }
  | { changed: false };

const valueOf = <T,>(field: DesignDocFieldInput<T> | undefined) =>
  field !== undefined && 'value' in field ? field.value : undefined;
const authorOf = <T,>(field: DesignDocFieldInput<T> | undefined) =>
  field !== undefined && 'value' in field ? field.author : undefined;

interface ChangeSetInput<Item, Key> {
  added?: Item[] | undefined;
  removed?: Key[] | undefined;
  modified?: Item[] | undefined;
}

const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);
const typeOf = (type: BuildingBlockRefInput): string => {
  if (typeof type === 'string') return addressOf(type);
  return `${typeOf(type.collectionOf)}[]`;
};
const humanType = (type: string | null | undefined) =>
  type?.replaceAll('_', ' ') ?? 'Unclassified';

function AuthorBadge({
  author = 'agent',
}: {
  author?: DesignDocFieldAuthor | undefined;
}) {
  return (
    author === 'human' && (
      <Badge size="xs" variant="light" ml="xs">
        human
      </Badge>
    )
  );
}

function Field({
  field,
  fallback = 'Not specified.',
}: {
  field: DesignDocFieldInput<string> | undefined;
  fallback?: string;
}) {
  const value = valueOf(field);
  return (
    <>
      {value === undefined ? (
        <Text component="span" c="dimmed">
          {fallback}
        </Text>
      ) : (
        <Text component="span" style={{ whiteSpace: 'pre-wrap' }}>
          {value}
        </Text>
      )}
      <AuthorBadge author={authorOf(field)} />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section" withBorder padding="lg">
      <Stack gap="sm">
        <Title order={2} size="h3">
          {title}
        </Title>
        {children}
      </Stack>
    </Card>
  );
}

function Changes<Item, Key>({
  set,
  keyOf,
  labelOf,
  render,
}: {
  set: ChangeSetInput<Item, Key> | undefined;
  keyOf: (item: Item) => string;
  labelOf: (key: Key) => string;
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
                <li key={labelOf(key)}>
                  <code>{labelOf(key)}</code>
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
function Parts<Item extends { name: string }>({
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
      <Title order={4} size="h5">
        {title}
      </Title>
      <Changes
        set={set}
        keyOf={(item) => item.name}
        labelOf={(name) => name}
        render={render}
      />
    </>
  );
}

function Types({
  title,
  set,
}: {
  title: string;
  set: ChangeSetInput<BuildingBlockRefInput, BuildingBlockRefInput> | undefined;
}) {
  if (set === undefined) return null;
  return (
    <>
      <Title order={4} size="h5">
        {title}
      </Title>
      <Changes
        set={set}
        keyOf={typeOf}
        labelOf={typeOf}
        render={(item) => <code>{typeOf(item)}</code>}
      />
    </>
  );
}

function Property({ property }: { property: DesignedPropertyInput }) {
  const type = valueOf(property.type);
  return (
    <Text>
      <code>
        {property.name}
        {valueOf(property.optional) ? '?' : ''}:{' '}
        {type === undefined ? '?' : typeOf(type)}
      </code>
      <AuthorBadge author={authorOf(property.type)} />
      {valueOf(property.description) ? (
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
          {rule.name}
        </Text>
        {valueOf(rule.ruleType) && (
          <Badge variant="outline">{valueOf(rule.ruleType)}</Badge>
        )}
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
      <Text fw={600}>{scenario.name}</Text>
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
      <Title order={3} size="h4">
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
      <Title order={3} size="h4">
        <code>{addressOf(block.id)}</code>
      </Title>
      <Text size="sm" c="dimmed">
        {humanType(valueOf(block.type))}
        <AuthorBadge author={authorOf(block.type)} />
      </Text>
      <Text>
        <Field field={block.description} />
      </Text>
      <Types title="Implements" set={block.implements} />
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
  const visibility = valueOf(behaviour.visibility);
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Title order={3} size="h4">
          <code>{addressOf(behaviour.id)}</code>
        </Title>
        {visibility?.kind === 'public' && (
          <Badge variant="outline">public</Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        {valueOf(behaviour.type) ?? 'Unclassified'}
        {visibility?.kind === 'public' && visibility.actors.length > 0
          ? ` · ${visibility.actors.join(', ')}`
          : ''}
      </Text>
      <Text>
        <Field field={behaviour.description} />
      </Text>
      <Types title="Input" set={behaviour.input} />
      <Types title="Output" set={behaviour.output} />
      <Types title="Uses" set={behaviour.usedBuildingBlocks} />
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
    <ReadingPane
      title={doc.name}
      icon={DesignDocsIcon}
      description={doc.implemented ? 'Implemented' : 'Draft'}
    >
      <Text>{doc.description}</Text>
      <Section title="Modules">
        <Changes
          set={doc.modules}
          keyOf={(module) => module.id}
          labelOf={addressOf}
          render={(module) => <Module module={module} />}
        />
      </Section>
      <Section title="Building blocks">
        <Changes
          set={doc.buildingBlocks}
          keyOf={(block) => block.id}
          labelOf={addressOf}
          render={(block) => <BuildingBlock block={block} />}
        />
      </Section>
      <Section title="Behaviours">
        <Changes
          set={doc.behaviours}
          keyOf={(behaviour) => behaviour.id}
          labelOf={addressOf}
          render={(behaviour) => <Behaviour behaviour={behaviour} />}
        />
      </Section>
    </ReadingPane>
  );
}
