import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignedScenarioInput } from '#backend/app/design-docs/design-doc.ts';
import { Description } from './description.tsx';
import { Field } from './field.tsx';

export function ScenarioBody({
  scenario,
}: {
  scenario: DesignedScenarioInput;
}) {
  return (
    <Stack gap="xs">
      <Description field={scenario.description} />
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
