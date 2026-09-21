import type { ReactNode } from 'react';
import { Card } from '#/shared/design-system/card.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type {
  DesignDocument,
  DesignedField,
  DesignedScenario,
} from '#backend/app/design-docs/design-doc.ts';

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

function Items({ items }: { items: { id: string; text: string }[] }) {
  return items.length ? (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
  ) : (
    <Text c="dimmed">None specified.</Text>
  );
}

function Fields({ fields }: { fields: DesignedField[] }) {
  return fields.length ? (
    <ul>
      {fields.map((field) => (
        <li key={field.id}>
          <strong>{field.label}</strong> —{' '}
          <code>
            {field.name}: {field.type}
          </code>
          {field.note ? ` — ${field.note}` : ''}
        </li>
      ))}
    </ul>
  ) : (
    <Text c="dimmed">No fields specified.</Text>
  );
}

function Scenarios({ scenarios }: { scenarios: DesignedScenario[] }) {
  return (
    <Stack>
      {scenarios.map((scenario) => (
        <Card key={scenario.id} withBorder padding="sm">
          <Text fw={600}>
            {scenario.kind === 'scenarioOutline'
              ? 'Scenario outline'
              : 'Scenario'}
            : {scenario.title}
          </Text>
          {scenario.tags.length > 0 && (
            <Text size="sm" c="dimmed">
              {scenario.tags
                .map((tag) => `@${tag.replace(/^@/, '')}`)
                .join(' ')}
            </Text>
          )}
          {scenario.background.length > 0 && (
            <>
              <Text fw={600}>Background</Text>
              {scenario.background.map((step) => (
                <Text key={step.id}>
                  <strong>{step.keyword}</strong> {step.text}
                </Text>
              ))}
            </>
          )}
          {scenario.steps.map((step) => (
            <Text key={step.id}>
              <strong>{step.keyword}</strong> {step.text}
            </Text>
          ))}
          {scenario.examples && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <caption>Examples</caption>
                <thead>
                  <tr>
                    {scenario.examples.headers.map((header, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Example columns are positional and have no IDs in the contract.
                      <th key={`${index}-${header}`} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenario.examples.rows.map((row) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Cells are addressed by their column position in the contract.
                        <td key={`${row.id}-${index}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </Stack>
  );
}

export function DesignDocumentContent({
  document: doc,
}: {
  document: DesignDocument;
}) {
  const names = new Map(
    [
      ...doc.actors,
      ...doc.boundedContexts,
      ...doc.domainModules,
      ...doc.buildingBlocks,
      ...doc.useCases,
      ...doc.behaviours,
    ].map((item) => [item.id, item.name]),
  );
  const name = (id: string | null) =>
    id ? (names.get(id) ?? id) : 'Not assigned';
  return (
    <Stack component="article" maw={1000}>
      <Title order={2}>{doc.name}</Title>
      <Text c="dimmed">
        {doc.status} · {doc.date}
      </Text>
      <Section title="Goal">
        <Text>{doc.goal || 'No goal specified.'}</Text>
      </Section>
      <Section title="Business context">
        {doc.businessContext.map((item) => (
          <Text key={item.id}>{item.text}</Text>
        ))}
      </Section>
      <Section title="Target outcomes">
        {doc.outcomes.map((item) => (
          <div key={item.id}>
            <Text>{item.text}</Text>
            {item.measure && (
              <Text size="sm" c="dimmed">
                Measure: {item.measure}
              </Text>
            )}
          </div>
        ))}
      </Section>
      <Section title="Scope">
        <Title order={4}>In scope</Title>
        <Items items={doc.scope.inScope} />
        <Title order={4}>Out of scope</Title>
        <Items items={doc.scope.outOfScope} />
      </Section>
      <Section title="Actors">
        {doc.actors.map((actor) => (
          <div key={actor.id}>
            <Text fw={600}>
              {actor.name} · {actor.kind}
            </Text>
            <Text>{actor.description}</Text>
          </div>
        ))}
      </Section>
      <Section title="Use cases">
        {doc.useCases.map((uc) => (
          <Stack key={uc.id} gap="sm">
            <Title order={4}>{uc.name}</Title>
            <Text size="sm" c="dimmed">
              {uc.type ?? 'Unclassified'} · {name(uc.applicationServiceId)}
            </Text>
            <Text>
              Actors: {uc.actorIds.map(name).join(', ') || 'None specified'}
            </Text>
            <Text>{uc.summary}</Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{uc.description}</Text>
            <Title order={5}>Rules</Title>
            <Items items={uc.rules} />
            <Title order={5}>Input</Title>
            <Fields fields={uc.input.fields} />
            <Title order={5}>Output</Title>
            <Text>{uc.output.summary}</Text>
            <Fields fields={uc.output.fields} />
            <Title order={5}>Acceptance scenarios</Title>
            <Scenarios scenarios={uc.acceptanceScenarios} />
            <Title order={5}>Quality attributes</Title>
            {uc.qualityAttributes.map((quality) => (
              <Text key={quality.id}>
                <strong>{quality.name}</strong>
                {quality.type ? ` (${quality.type})` : ''}: {quality.text}
              </Text>
            ))}
          </Stack>
        ))}
      </Section>
      <Section title="Bounded contexts">
        {doc.boundedContexts.map((context) => (
          <div key={context.id}>
            <Text fw={600}>{context.name}</Text>
            <Text>{context.description}</Text>
          </div>
        ))}
      </Section>
      <Section title="Domain modules">
        {doc.domainModules.map((module) => (
          <div key={module.id}>
            <Text fw={600}>
              {module.name} · {name(module.boundedContextId)}
            </Text>
            <Text>{module.description}</Text>
          </div>
        ))}
      </Section>
      <Section title="Building blocks">
        {doc.buildingBlocks.map((block) => (
          <Stack key={block.id} gap="xs">
            <Title order={4}>{block.name}</Title>
            <Text size="sm" c="dimmed">
              {block.type?.replaceAll('_', ' ') ?? 'Unclassified'} ·{' '}
              {name(block.boundedContextId)}
              {block.domainModuleId ? ` · ${name(block.domainModuleId)}` : ''}
            </Text>
            <Text>{block.description}</Text>
            {block.implements.length > 0 && (
              <Text>Implements: {block.implements.map(name).join(', ')}</Text>
            )}
            <ul>
              {block.properties.map((property) => (
                <li key={property.id}>
                  <code>
                    {property.name}: {property.type}
                    {property.collection ? '[]' : ''}
                    {property.nullable ? ' | null' : ''}
                  </code>
                  {property.description ? ` — ${property.description}` : ''}
                </li>
              ))}
            </ul>
          </Stack>
        ))}
      </Section>
      <Section title="Behaviours">
        {doc.behaviours.map((behaviour) => (
          <Stack key={behaviour.id} gap="xs">
            <Title order={4}>{behaviour.name}</Title>
            <Text size="sm" c="dimmed">
              {name(behaviour.buildingBlockId)} ·{' '}
              {behaviour.type ?? 'Unclassified'}
            </Text>
            {behaviour.useCaseId && (
              <Text>Use case: {name(behaviour.useCaseId)}</Text>
            )}
            <Text>{behaviour.description}</Text>
            <Scenarios scenarios={behaviour.scenarios} />
          </Stack>
        ))}
      </Section>
    </Stack>
  );
}
