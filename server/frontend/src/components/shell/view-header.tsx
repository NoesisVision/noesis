import { Anchor, Breadcrumbs, Stack, Text, Title } from '@mantine/core';
import { Link, useMatches } from '@tanstack/react-router';

/**
 * Every content view opens with this: breadcrumbs then the view title, both
 * derived from the matched routes. A route contributes crumbs through
 * `staticData.breadcrumb`; the change layout route contributes
 * `Changes / <change name>` from its loader data, so no map is maintained.
 */
export function ViewHeader() {
  const matches = useMatches();
  const crumbs: { label: string; to?: string }[] = [];
  for (const match of matches) {
    const change = (
      match.loaderData as { change?: { name: string } } | undefined
    )?.change;
    if (change) {
      crumbs.push({ label: 'Changes' });
      crumbs.push({ label: change.name, to: match.pathname });
    }
    for (const label of match.staticData.breadcrumb ?? []) {
      crumbs.push({ label });
    }
  }
  const title = crumbs.at(-1)?.label ?? 'Noesis';
  const trail = crumbs.slice(0, -1);

  return (
    <Stack gap="xs" mb="lg">
      <Breadcrumbs>
        {trail.map((crumb) =>
          crumb.to ? (
            <Anchor
              key={crumb.label}
              size="sm"
              c="dimmed"
              renderRoot={(props) => <Link {...props} to={crumb.to} />}
            >
              {crumb.label}
            </Anchor>
          ) : (
            <Text key={crumb.label} size="sm" c="dimmed">
              {crumb.label}
            </Text>
          ),
        )}
        <Text size="sm">{title}</Text>
      </Breadcrumbs>
      <Title order={2}>{title}</Title>
    </Stack>
  );
}
