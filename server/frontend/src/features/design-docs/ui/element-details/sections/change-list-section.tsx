import { IconLink } from '@tabler/icons-react';
import { Group } from '#/shared/design-system/group.tsx';
import { List } from '#/shared/design-system/list.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { OutlineKind } from '#/shared/ui/model-tree/model-outline.ts';
import type { ChangeListItem } from '../change-list-items.ts';
import { useElementNavigation } from '../element-navigation.ts';
import type { ElementRef } from '../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { Ref } from './ref.tsx';
import classes from './change-list-section.module.css';

interface ChangeListSectionProps {
  element: ElementRef;
  title: string;
  /** The kind of thing listed, which names the icon before the title. */
  kind: OutlineKind;
  items: ChangeListItem[];
}

/**
 * What the design does to one list an element keeps — what it implements, its
 * properties, rules and scenarios, a behaviour's input and output — one line
 * each, coloured by the change. A line whose row is in the tree opens it, as
 * a click on the row itself would.
 */
export function ChangeListSection({
  title,
  kind,
  items,
}: ChangeListSectionProps) {
  const { has, select } = useElementNavigation();
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <DetailSection title={title} icon={<KindIcon kind={kind} />}>
      <List listStyleType="none" spacing="xs" size="sm" center pl={0}>
        {sorted.map(({ change, label, path }) => {
          const ref = <Ref change={change} name={label} />;
          return (
            <List.Item key={`${change}:${label}`}>
              {path !== null && has(path) ? (
                <UnstyledButton
                  className={classes.item}
                  onClick={() => select(path)}
                >
                  <Group gap="xs">
                    {/* Decorative: that the line opens a row is the button's to say. */}
                    <ThemeIcon color="gray" size={16} aria-hidden="true">
                      <IconLink size={12} />
                    </ThemeIcon>
                    {ref}
                  </Group>
                </UnstyledButton>
              ) : (
                ref
              )}
            </List.Item>
          );
        })}
      </List>
    </DetailSection>
  );
}

/** Shown only when the design touches the list at all. */
ChangeListSection.shows = ({ items }: ChangeListSectionProps) =>
  items.length > 0;
