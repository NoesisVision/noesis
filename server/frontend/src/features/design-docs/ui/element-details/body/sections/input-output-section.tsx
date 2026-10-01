import { IconLink } from '@tabler/icons-react';
import { List } from '#/shared/design-system/list.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import type { ElementRef } from '../../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { Ref, shortName } from './ref.tsx';
import classes from './input-output-section.module.css';

interface InputOutputSectionProps {
  element: ElementRef;
  input: ChangeListItem[];
  output: ChangeListItem[];
}

/**
 * What a behaviour takes and what it gives back, read together: one line per
 * parameter or result the design touches, coloured by the change. A copy of
 * `ChangeListSection` for now, so the two can part ways as this one grows.
 */
export function InputOutputSection({ input, output }: InputOutputSectionProps) {
  return (
    <DetailSection
      title="Input / Output"
      icon={<KindIcon kind="building_block" pattern={null} />}
    >
      <InputOutputLists input={input} output={output} />
    </DetailSection>
  );
}

/** The two lists alone, for a section that reads a behaviour among others. */
export function InputOutputLists({
  input,
  output,
}: {
  input: ChangeListItem[];
  output: ChangeListItem[];
}) {
  return (
    <>
      <Items label="Input" items={input} />
      <Items label="Output" items={output} />
    </>
  );
}

/** One side of the section, left out when the design does not touch it. */
function Items({ label, items }: { label: string; items: ChangeListItem[] }) {
  const { has, select } = useElementNavigation();
  if (items.length === 0) return null;
  // Read by the type, not by the name: `name: a.b.C` sorts as `C`.
  const sortKey = (label: string) => shortName(label).type;
  const sorted = [...items].sort((a, b) =>
    sortKey(a.label).localeCompare(sortKey(b.label)),
  );

  return (
    <>
      <Text size="xs" c="dimmed" mt="xs">
        {label}
      </Text>
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
                <Ref change={change} name={label} interactive qualified />
              </UnstyledButton>
            ) : (
              <Ref change={change} name={label} qualified />
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
    </>
  );
}

/** Shown only when the design touches either side at all. */
InputOutputSection.shows = ({ input, output }: InputOutputSectionProps) =>
  input.length + output.length > 0;
