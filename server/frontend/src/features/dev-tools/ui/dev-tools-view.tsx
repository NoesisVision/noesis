import { DiagramThemeChoice } from '#/features/system-model/diagram-themes.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Switch } from '#/shared/design-system/switch';
import {
  featureDescription,
  useDevToolsContext,
  useSetDevToolsFeatures,
} from '#/shared/dev-tools/dev-tools-context.tsx';
import { titleCase } from '#/shared/ui/title-case.ts';

/**
 * A feature flag's name as a reader reads it: `showV2Tree` becomes
 * `Show V2 Tree`. A word starts at each capital
 * that follows a lower-case letter or a digit.
 */
export function featureLabel(name: string): string {
  return titleCase(name.replace(/(?<=[\p{Ll}\d])(?=\p{Lu})/gu, ' '));
}

export function DevToolsView() {
  const { features } = useDevToolsContext();
  const setFeatures = useSetDevToolsFeatures();
  const featureList = Object.entries(features);
  return (
    <Stack gap="lg" align="flex-start">
      <Stack gap="md" maw={520}>
        {featureList.map(([name, enabled]) => {
          return (
            <Switch
              key={name}
              label={featureLabel(name)}
              description={featureDescription(name)}
              size="md"
              onLabel="ON"
              offLabel="OFF"
              checked={enabled}
              onChange={() => {
                setFeatures((prevFeatures) => {
                  return {
                    ...prevFeatures,
                    [name]: !enabled,
                  };
                });
              }}
            />
          );
        })}
      </Stack>
      <DiagramThemeChoice />
    </Stack>
  );
}
