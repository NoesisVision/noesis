import type { ReactNode } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedPropertyInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';
import classes from './element-detail.module.css';

/*
 * One element of the design, read whole: where it sits, what it is, and what
 * the document says about it. The tree beside it says what changed; this says
 * what the thing is.
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

export function ElementDetail({
  node,
  path,
  document: doc,
}: {
  node: OutlineNode;
  /** The line from the top of the tree down to the node, the node last. */
  path: readonly OutlineNode[];
  document: DesignDocumentInput;
}) {
  return (
    <Stack gap="sm">
      <Breadcrumb path={path} />
      <Group gap="xs" align="baseline">
        <Title order={2} size="h3">
          {node.name}
        </Title>
        {node.patternLabel !== null && (
          <Text span c="dimmed">
            {node.patternLabel}
          </Text>
        )}
        <ChangeBadge change={node.change} />
      </Group>
      <Body node={node} document={doc} />
    </Stack>
  );
}

/**
 * The path in words, under the rails that draw it: a reader who followed a
 * search result into the middle of a deep tree can still say where they are.
 */
function Breadcrumb({ path }: { path: readonly OutlineNode[] }) {
  if (path.length < 2) return null;
  return (
    <Text size="xs" c="dimmed" className={classes.breadcrumb}>
      {path.slice(0, -1).map((step, index) => (
        <span key={step.path}>
          {index > 0 && <span aria-hidden> › </span>}
          {step.name}
        </span>
      ))}
    </Text>
  );
}

function ChangeBadge({ change }: { change: OutlineNode['change'] }) {
  if (change === 'unchanged') return null;
  const colour =
    change === 'added' ? 'green' : change === 'modified' ? 'blue' : 'red';
  return (
    <Badge color={colour} variant="light">
      {change}
    </Badge>
  );
}

function Body({
  node,
  document: doc,
}: {
  node: OutlineNode;
  document: DesignDocumentInput;
}) {
  if (node.change === 'removed') {
    return (
      <Text c="dimmed">This design removes it. Nothing else is said.</Text>
    );
  }
  if (node.elementId === null) {
    return <PartBody node={node} document={doc} />;
  }
  const module = findById(doc.modules, node.elementId);
  if (module) return <ModuleBody module={module} />;
  const block = findById(doc.buildingBlocks, node.elementId);
  if (block) return <BuildingBlockBody block={block} />;
  const behaviour = findById(doc.behaviours, node.elementId);
  if (behaviour) return <BehaviourBody behaviour={behaviour} />;
  return (
    <Text c="dimmed">
      This design does not change it; it is here because the elements under it
      are.
    </Text>
  );
}

function ModuleBody({ module }: { module: DesignedDomainModuleInput }) {
  return (
    <Text className={classes.prose}>
      <Field field={module.description} />
    </Text>
  );
}

function BuildingBlockBody({ block }: { block: DesignedBuildingBlockInput }) {
  return (
    <Stack gap="xs">
      <Text className={classes.prose}>
        <Field field={block.description} />
      </Text>
      {block.implements && block.implements.length > 0 && (
        <Text>Implements: {block.implements.map(addressOf).join(', ')}</Text>
      )}
    </Stack>
  );
}

function BehaviourBody({ behaviour }: { behaviour: DesignedBehaviourInput }) {
  return (
    <Stack gap="xs">
      {(behaviour.actor?.value || behaviour.isPublic) && (
        <Group gap="xs">
          {behaviour.actor?.value && (
            <Text size="sm" c="dimmed">
              {behaviour.actor.value}
            </Text>
          )}
          {behaviour.isPublic && <Badge variant="outline">public</Badge>}
        </Group>
      )}
      <Text className={classes.prose}>
        <Field field={behaviour.description} />
      </Text>
      <Strings title="Input" set={behaviour.input} />
      <Strings title="Output" set={behaviour.output} />
      <Strings title="Uses" set={behaviour.usedBuildingBlocks} />
    </Stack>
  );
}

function PartBody({
  node,
  document: doc,
}: {
  node: OutlineNode;
  document: DesignDocumentInput;
}) {
  const owner = node.parentPath;
  if (owner === null) return null;
  const parts =
    findById(doc.buildingBlocks, owner) ?? findById(doc.behaviours, owner);
  if (parts === null) return null;

  if (node.kind === 'property' && 'properties' in parts) {
    const property = findByName(parts.properties, node.name);
    return property ? <PropertyBody property={property} /> : null;
  }
  if (node.kind === 'rule') {
    const rule = findByName(parts.rules, node.name);
    return rule ? <RuleBody rule={rule} /> : null;
  }
  const scenario = findByName(parts.scenarios, node.name);
  return scenario ? <ScenarioBody scenario={scenario} /> : null;
}

function PropertyBody({ property }: { property: DesignedPropertyInput }) {
  return (
    <Stack gap="xs">
      <Text>
        <code>
          <Field field={property.name} />:{' '}
          <Field field={property.type} fallback="?" />
          {property.collection ? '[]' : ''}
          {property.nullable ? ' | null' : ''}
        </code>
      </Text>
      <Text className={classes.prose}>
        <Field field={property.description} />
      </Text>
    </Stack>
  );
}

function RuleBody({ rule }: { rule: DesignedRuleInput }) {
  return (
    <Text className={classes.prose}>
      <Field field={rule.description} />
    </Text>
  );
}

function ScenarioBody({ scenario }: { scenario: DesignedScenarioInput }) {
  return (
    <Stack gap="xs">
      <Text className={classes.prose}>
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
        <Text component="span">{value}</Text>
      )}
      {field?.reviewedByHuman && (
        <Badge size="xs" variant="light" ml="xs">
          reviewed
        </Badge>
      )}
    </>
  );
}

/** A change set of bare names, shown only when the design touches it. */
function Strings({
  title,
  set,
}: {
  title: string;
  set: ChangeSetInput<string, string> | undefined;
}) {
  const added = set?.added ?? [];
  const modified = set?.modified ?? [];
  const removed = set?.removed ?? [];
  if (!added.length && !modified.length && !removed.length) return null;
  return (
    <>
      <Title order={3} size="h6">
        {title}
      </Title>
      <Stack gap={2}>
        <Names change="added" colour="green" names={added} />
        <Names change="modified" colour="blue" names={modified} />
        <Names change="removed" colour="red" names={removed} />
      </Stack>
    </>
  );
}

function Names({
  change,
  colour,
  names,
}: {
  change: string;
  colour: string;
  names: string[];
}): ReactNode {
  if (names.length === 0) return null;
  return (
    <Group gap="xs" wrap="wrap">
      <Badge size="xs" color={colour} variant="light">
        {change}
      </Badge>
      {names.map((name) => (
        <code key={name}>{addressOf(name)}</code>
      ))}
    </Group>
  );
}

function findById<Item extends { id: string }>(
  set: ChangeSetInput<Item, string> | undefined,
  id: string,
): Item | null {
  const named = (item: Item) => item.id === id;
  return set?.added?.find(named) ?? set?.modified?.find(named) ?? null;
}

function findByName<Item extends { name: ReviewableInput }>(
  set: ChangeSetInput<Item, string> | undefined,
  name: string,
): Item | null {
  const named = (item: Item) => item.name.value === name;
  return set?.added?.find(named) ?? set?.modified?.find(named) ?? null;
}
