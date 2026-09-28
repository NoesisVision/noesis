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
  /** Set for types and declarations, which read as code; not for prose names. */
  monospace?: boolean;
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
  monospace = false,
}: ChangeListSectionProps) {
  const { has, select } = useElementNavigation();
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <DetailSection title={title} icon={<KindIcon kind={kind} />}>
      <ul className={classes.list}>
        {sorted.map(({ change, label, path }) => {
          const ref = (
            <Ref change={change} name={label} monospace={monospace} />
          );
          return (
            <li key={`${change}:${label}`}>
              {path !== null && has(path) ? (
                <UnstyledButton
                  className={classes.item}
                  onClick={() => select(path)}
                >
                  {ref}
                </UnstyledButton>
              ) : (
                ref
              )}
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}

/** Shown only when the design touches the list at all. */
ChangeListSection.shows = ({ items }: ChangeListSectionProps) =>
  items.length > 0;
