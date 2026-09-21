import type { IconProps } from '@tabler/icons-react';
import type {
  ForwardRefExoticComponent,
  PropsWithChildren,
  ReactNode,
  RefAttributes,
} from 'react';
import { Group } from '#/components/design-system/group.tsx';
import { Text } from '#/components/design-system/text.tsx';
import classes from './overview-stat.module.css';

interface OverviewStatProps extends PropsWithChildren {
  title: ReactNode;
  Icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
}
export function OverviewStat({ children, Icon, title }: OverviewStatProps) {
  return (
    <Group>
      <Icon size={40} stroke={1} className={classes.icon} />
      <div>
        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
          {title}
        </Text>
        <Text fw={700} size="xl">
          {children}
        </Text>
      </div>
    </Group>
  );
}
