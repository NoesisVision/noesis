import { IconBraces, IconLink, IconScale } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineKind } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { List } from '#/shared/design-system/list.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { shortName } from '#/shared/ui/qualified-name.tsx';
import { NewRuleButton } from '../../../unit-editor/new-buttons.tsx';
import { useWritableUnit } from '../../../unit-editor/writable-unit.ts';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { type ElementRef, partOwnerOf } from '../../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { PropertyGrid } from './property-grid.tsx';
import { Ref } from './ref.tsx';
import { RuleCards } from './rule-cards.tsx';
import classes from './change-list-section.module.css';

interface ChangeListSectionProps {
  element: ElementRef;
  title: string;
  /** The kind of thing listed, which names the icon before the title. */
  kind: OutlineKind;
  items: ChangeListItem[];
}

/**
 * What the design does to one list an element keeps — its properties, rules
 * and scenarios, a behaviour's input and output — one line each, coloured by the change. A line whose row is in the tree opens it, as
 * a click on the row itself would. Properties read as tiles and rules as
 * cards, each with what the design says about it.
 */
export function ChangeListSection({
  element,
  title,
  kind,
  items,
}: ChangeListSectionProps) {
  const { has, select } = useElementNavigation();
  const owner = partOwnerOf(element);
  // An element's rules are listed where it may be written even before it
  // has any, for the first to be added there.
  const writable = useWritableUnit(
    kind === 'rule' && owner !== null
      ? { kind: owner.kind, id: owner.id }
      : null,
  );
  if (items.length === 0 && writable === null) return null;
  // Building blocks go by qualified names, read by their last segment.
  const qualified = kind === 'building_block';
  const sortKey = (label: string) =>
    qualified ? shortName(label).type : label;
  // Rules read in the design's own order, the newest added on top; the
  // rest by name.
  const sorted =
    kind === 'rule'
      ? items
      : [...items].sort((a, b) =>
          sortKey(a.label).localeCompare(sortKey(b.label)),
        );

  return (
    <DetailSection
      title={title}
      icon={SECTION_ICONS[kind] ?? <KindIcon kind={kind} pattern={null} />}
      action={
        writable !== null && owner !== null && <NewRuleButton owner={owner} />
      }
    >
      {kind === 'property' ? (
        <PropertyGrid items={sorted} owner={owner} />
      ) : kind === 'rule' ? (
        sorted.length === 0 ? (
          <Text size="sm" c="dimmed">
            No rules yet.
          </Text>
        ) : (
          <RuleCards items={sorted} owner={owner} />
        )
      ) : (
        <List listStyleType="none" spacing="xs" size="sm" center pl={0}>
          {sorted.map(({ change, label, path, description }) => (
            <List.Item key={`${change}:${label}`}>
              {path !== null && has(path) ? (
                <UnstyledButton
                  className={classes.item}
                  onClick={() => select(path)}
                >
                  {/* Spans, not a Group or a ThemeIcon: both are divs, and a
                      button holds only phrasing content. Decorative: that the
                      line opens a row is the button's to say. */}
                  <span className={classes.mark} aria-hidden="true">
                    <IconLink size={12} />
                  </span>
                  <Ref
                    change={change}
                    name={label}
                    interactive
                    qualified={qualified}
                  />
                </UnstyledButton>
              ) : (
                <Ref change={change} name={label} qualified={qualified} />
              )}
              {/* A span: the item's label is one, and holds phrasing only. */}
              {description !== undefined && (
                <Text component="span" display="block" size="xs" c="dimmed">
                  {description}
                </Text>
              )}
            </List.Item>
          ))}
        </List>
      )}
    </DetailSection>
  );
}

/** The design's own marks for the lists it draws its own way; the kind's icon for the rest. */
const SECTION_ICONS: Partial<Record<OutlineKind, ReactNode>> = {
  property: <IconBraces />,
  rule: <IconScale />,
};

/** Shown only when the design touches the list at all. */
/**
 * Shown when there is something to list — and an element's rules always, for
 * where it may be written the first is added there; the section itself says
 * when it may not.
 */
ChangeListSection.shows = ({ items, kind, element }: ChangeListSectionProps) =>
  items.length > 0 || (kind === 'rule' && partOwnerOf(element) !== null);
