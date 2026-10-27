import { useId } from 'react';
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { THEMES } from './themes.ts';
import { useDiagramThemeChoice } from './use-diagram-theme.ts';

/*
 * The theme the exploration draws its diagram in, chosen on the Dev Tools
 * page — an experiment as the flags there are, kept on this machine.
 */
export function DiagramThemeChoice() {
  const [theme, setTheme] = useDiagramThemeChoice();
  const title = useId();
  return (
    <Stack gap={6}>
      <Text id={title} fw={600}>
        Diagram theme
      </Text>
      <SegmentedControl
        aria-labelledby={title}
        data={THEMES.map(({ id, label }) => ({ value: id, label }))}
        value={theme}
        onChange={(value) => {
          const chosen = THEMES.find(({ id }) => id === value);
          if (chosen !== undefined) setTheme(chosen.id);
        }}
      />
    </Stack>
  );
}
