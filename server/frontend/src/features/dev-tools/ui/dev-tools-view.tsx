import { Box } from '#/shared/design-system/box.tsx';
import { Switch } from '#/shared/design-system/switch';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';

export function DevToolsView() {
  const { features, setFeatures } = useDevToolsContext();
  const featureList = Object.entries(features);
  return (
    <Box>
      {featureList.map(([name, enabled]) => {
        return (
          <Switch
            key={name}
            label={name}
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
