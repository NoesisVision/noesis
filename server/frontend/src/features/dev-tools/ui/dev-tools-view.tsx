import { Box } from '#/shared/design-system/box.tsx';
import { Switch } from '#/shared/design-system/switch';
import {
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
    <Box>
      {featureList.map(([name, enabled]) => {
        return (
          <Switch
            key={name}
            label={featureLabel(name)}
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
    </Box>
  );
}
