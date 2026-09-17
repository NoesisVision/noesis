import { Link, useMatches } from '@tanstack/react-router';
import { Anchor } from '#/components/design-system/anchor.tsx';
import { Breadcrumbs } from '#/components/design-system/breadcrumbs.tsx';
import { Text } from '#/components/design-system/text.tsx';

interface CrumbsProps {
  title?: string;
}

export function Crumbs({ title }: CrumbsProps) {
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
  const trail = crumbs.slice(0, -1);
  const targetTitle = (title || crumbs.at(-1)?.label) ?? 'Noesis';

  return (
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
      <Text size="sm">{targetTitle}</Text>
    </Breadcrumbs>
  );
}
