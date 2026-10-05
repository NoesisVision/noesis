import { useMemo } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type ArchitectureCheck,
  type ArchitectureOutline,
  LEVEL_LABEL,
  placedById,
} from '../../architecture-outline.ts';
import { inferredFlowOf } from '../../design-doc-architecture.ts';
import { nameOf } from '../../element-id.ts';
import { ElementLinks } from './element-links.tsx';
import type { LaidOutNode } from './layout-architecture.ts';
import classes from './architecture-details.module.css';

/** What the architecture finds about one element: its checks, its types, the flow its types suggest. */
export function ElementFindings({
  id,
  outline,
  document: doc,
  cards,
  onSelect,
}: {
  id: string;
  outline: ArchitectureOutline;
  document: DesignDocumentInput;
  cards: ReadonlyMap<string, LaidOutNode>;
  onSelect: (id: string) => void;
}) {
  const checks = outline.checks.filter(
    (check) => check.level !== 'pass' && check.elementIds.includes(id),
  );
  const flows = useMemo(
    () => inferredFlowOf(doc, outline, id),
    [doc, outline, id],
  );
  // Not every element has a card of its own; the outline holds the rest.
  const uses =
    cards.get(id)?.element?.uses ?? placedById(outline).get(id)?.uses ?? [];
  return (
    <>
      {checks.length > 0 && (
        <section className={classes.section}>
          <Title order={3} size={13} className={classes.sectionTitle}>
            Checks
          </Title>
          <ul className={classes.findings}>
            {checks.map((check) => (
              <li key={check.id}>
                <Badge
                  color={LEVEL_COLOUR[check.level]}
                  variant="light"
                  size="sm"
                  tt="none"
                  flex="none"
                >
                  {LEVEL_LABEL[check.level]}
                </Badge>
                <span>{check.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ElementLinks
        title="Speaks in"
        ids={uses}
        cards={cards}
        onSelect={onSelect}
      />
      {flows.length > 0 && (
        <section className={classes.section}>
          <Title order={3} size={13} className={classes.sectionTitle}>
            Flow inferred from types
          </Title>
          <ul className={classes.findings}>
            {flows.map((flow) => (
              <li key={`${flow.direction}:${flow.type}:${flow.other.id}`}>
                <span className={classes.direction}>
                  {flow.direction === 'gives' ? 'gives' : 'takes'}
                </span>
                <span>
                  <code>{nameOf(flow.type)}</code>
                  {flow.direction === 'gives' ? ' to ' : ' from '}
                  {`${flow.other.owner}.${flow.other.name}`}
                  {flow.typeMatchOnly && (
                    <span className={classes.note}> · type match only</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** A level is a word as well as a colour. */
const LEVEL_COLOUR: Record<ArchitectureCheck['level'], string> = {
  warning: 'orange',
  note: 'gray',
  pass: 'green',
};
