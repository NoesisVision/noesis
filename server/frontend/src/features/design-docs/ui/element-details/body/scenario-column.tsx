import { Accordion } from '#/shared/design-system/accordion.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../design-doc-field.ts';
import { ChangeBadge } from '../change-badge.tsx';
import type { ScenarioEntry } from './scenarios-of.ts';
import { DetailSection } from './sections/detail-section.tsx';
import { ScenarioSteps } from './sections/scenario-steps-section.tsx';

/**
 * An element's scenarios, in a column of their own beside its sections: each
 * one folded to its name — and the rule it belongs to, if any — and opened
 * to what it says.
 */
export function ScenarioColumn({ scenarios }: { scenarios: ScenarioEntry[] }) {
  return (
    <DetailSection
      title="Scenarios"
      icon={<KindIcon kind="scenario" pattern={null} />}
    >
      <Accordion multiple variant="separated" chevronPosition="right">
        {scenarios.map((entry, index) => (
          <Accordion.Item
            key={`${entry.rule ?? ''}:${entry.change}:${entry.name}`}
            // The value goes into the ids Mantine writes, which take no spaces.
            value={String(index)}
          >
            <Accordion.Control>
              <Group gap="xs" wrap="nowrap" component="span">
                <Text
                  component="span"
                  size="sm"
                  td={entry.change === 'removed' ? 'line-through' : undefined}
                >
                  {entry.name}
                </Text>
                <ChangeBadge change={entry.change} inline />
                {entry.rule !== undefined && (
                  <Text component="span" size="xs" c="dimmed">
                    {entry.rule}
                  </Text>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {entry.scenario === null ? (
                <Text c="dimmed" size="sm">
                  This design removes it.
                </Text>
              ) : (
                <ScenarioBody scenario={entry.scenario} />
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </DetailSection>
  );
}

function ScenarioBody({ scenario }: { scenario: DesignedScenarioInput }) {
  const description = valueOf(scenario.description)?.trim();
  return (
    <>
      {description && (
        <Text size="sm" c="dimmed" mb="xs">
          {description}
        </Text>
      )}
      <ScenarioSteps scenario={scenario} />
    </>
  );
}
