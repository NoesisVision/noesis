import type { ReactNode } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { CHANGE_COLOUR } from '#/shared/ui/model-tree/outline-change.ts';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedPropertyInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { OutlineNode } from '#backend/ui/model-outline/model-outline.ts';
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
  onSelect,
}: {
  node: OutlineNode;
  /** The line from the top of the tree down to the node, the node last. */
  path: readonly OutlineNode[];
  document: DesignDocumentInput;
  /** Takes the reader to another element, as the tree itself would. */
  onSelect: (path: string) => void;
}) {
  return (
    <Stack gap="sm">
      <Breadcrumb path={path} onSelect={onSelect} />
      <Group gap="xs" align="baseline">
        <Title order={2} size="h3" className={classes.name}>
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
 * search result into the middle of a deep tree can still say where they are,
 * and can step back up it.
 *
 * A list inside a landmark, because that is what a trail is: the order and
 * the nesting are in the markup, and the chevron between the steps is drawn
 * by the stylesheet, where a reader who cannot see it is not made to hear it.
 */
function Breadcrumb({
  path,
  onSelect,
}: {
  path: readonly OutlineNode[];
  onSelect: (path: string) => void;
}) {
  const above = path.slice(0, -1);
  if (above.length === 0) return null;
  return (
    <nav aria-label="Where this element sits">
      <ol className={classes.breadcrumb}>
        {above.map((step) => (
          <li key={step.path}>
            <UnstyledButton
              className={classes.step}
              onClick={() => onSelect(step.path)}
            >
              {step.name}
            </UnstyledButton>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ChangeBadge({ change }: { change: OutlineNode['change'] }) {
  const colour = CHANGE_COLOUR[change];
  if (colour === null) return null;
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
  if (module) return <ModuleBody module={module} at={node.path} />;
  const block = findById(doc.buildingBlocks, node.elementId);
  if (block) return <BuildingBlockBody block={block} at={node.path} />;
  const behaviour = findById(doc.behaviours, node.elementId);
  if (behaviour) return <BehaviourBody behaviour={behaviour} at={node.path} />;
  return (
    <Text c="dimmed">
      This design does not change it; it is here because the elements under it
      are.
    </Text>
  );
}

function ModuleBody({
  module,
  at,
}: {
  module: DesignedDomainModuleInput;
  at: string;
}) {
  return <Description field={module.description} at={at} />;
}

function BuildingBlockBody({
  block,
  at,
}: {
  block: DesignedBuildingBlockInput;
  at: string;
}) {
  return (
    <Stack gap="xs">
      <Description field={block.description} at={at} />
      {block.implements && block.implements.length > 0 && (
        <Text>Implements: {block.implements.map(addressOf).join(', ')}</Text>
      )}
    </Stack>
  );
}

function BehaviourBody({
  behaviour,
  at,
}: {
  behaviour: DesignedBehaviourInput;
  at: string;
}) {
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
      <Description field={behaviour.description} at={at} />
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
    return property ? (
      <PropertyBody property={property} at={node.path} />
    ) : null;
  }
  if (node.kind === 'rule') {
    const rule = findByName(parts.rules, node.name);
    return rule ? <RuleBody rule={rule} at={node.path} /> : null;
  }
  const scenario = findByName(parts.scenarios, node.name);
  return scenario ? <ScenarioBody scenario={scenario} at={node.path} /> : null;
}

function PropertyBody({
  property,
  at,
}: {
  property: DesignedPropertyInput;
  at: string;
}) {
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
      <Description field={property.description} at={at} />
    </Stack>
  );
}

function RuleBody({ rule, at }: { rule: DesignedRuleInput; at: string }) {
  return <Description field={rule.description} at={at} />;
}

function ScenarioBody({
  scenario,
  at,
}: {
  scenario: DesignedScenarioInput;
  at: string;
}) {
  return (
    <Stack gap="xs">
      <Description field={scenario.description} at={at} />
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

/**
 * A description is markdown, and the diagrams in it are drawn: it is the one
 * field long enough to be written rather than named. The editor reads its
 * markdown once, on mount, so another element is another editor — which is
 * what mounting it under the element's own path says.
 *
 * `headingLevel` puts the document's own `#` at `h3`: the page is headed by
 * the design, the panel by the element, and the prose nests under both.
 */
function Description({
  field,
  at,
}: {
  field: ReviewableInput | undefined;
  at: string;
}) {
  const value = field?.value ?? null;
  if (value === null || value.trim() === '') {
    return <Text c="dimmed">Not specified.</Text>;
  }
  return (
    <Stack gap="xs">
      {field?.reviewedByHuman && (
        <Badge size="xs" variant="light" w="fit-content">
          reviewed
        </Badge>
      )}
      <MarkdownEditor key={at} markdown={value} readOnly headingLevel={3} />
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
