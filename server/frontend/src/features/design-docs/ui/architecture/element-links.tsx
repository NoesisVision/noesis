import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { nameOf } from '../../element-id.ts';
import type { LaidOutNode } from './layout-architecture.ts';
import classes from './architecture-details.module.css';

/** The elements something is about, each a way to it; or a word on why there are none. */
export function ElementLinks({
  title,
  ids,
  cards,
  empty,
  onSelect,
}: {
  title: string;
  ids: string[];
  cards: ReadonlyMap<string, LaidOutNode>;
  empty?: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (ids.length === 0 && empty === undefined) return null;
  return (
    <section className={classes.section}>
      <Title order={3} size={13} className={classes.sectionTitle}>
        {title}
      </Title>
      {ids.length === 0 ? (
        <Text className={classes.text}>{empty}</Text>
      ) : (
        <ul className={classes.chips}>
          {ids.map((id) => (
            <li key={id}>
              <UnstyledButton
                className={classes.chip}
                onClick={() => onSelect(id)}
              >
                {cards.get(id)?.label ?? nameOf(id)}
              </UnstyledButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
