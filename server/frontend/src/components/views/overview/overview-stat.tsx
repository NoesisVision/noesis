import type { IconProps } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Group } from '#/components/design-system/group.tsx';
import { Text } from '#/components/design-system/text.tsx';
import type { AppRoutePaths } from '#/components/shell/sidebar.routes.ts';
import classes from './overview-stat.module.css';

interface OverviewStatProps extends PropsWithChildren {
  changeId: string | null;
  title: ReactNode;
  Icon: React.ForwardRefExoticComponent<
    IconProps & React.RefAttributes<SVGSVGElement>
  >;
  to: AppRoutePaths;
}
export function OverviewStat({
  changeId,
  children,
  Icon,
  title,
  to,
}: OverviewStatProps) {
  return (
    <Group>
      <Icon size={40} stroke={1} className={classes.icon} />
      <div>
        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
          {title}
        </Text>
        <Text fw={700} size="xl">
          {changeId ? (
            <Link
              className={classes.link}
              to={to as string}
              params={{
                changeId,
              }}
              activeOptions={{ exact: true }}
            >
              {children}
            </Link>
          ) : (
            children
          )}
        </Text>
      </div>
    </Group>
  );
}
