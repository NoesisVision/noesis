import { type ReactNode, useMemo } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Code } from '#/shared/design-system/code.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type ArchitectureOutline,
  CHECK_LEVEL_META,
  placedById,
} from '../../architecture-outline.ts';
import { inferredFlowOf } from '../../design-doc-architecture.ts';
import { nameOf } from '../../element-id.ts';
import { DetailSection } from './detail-parts.tsx';
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
    (check) =>
      check.level !== 'pass' && check.elementIds.some((one) => one === id),
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
        <DetailSection title="Checks">
          <Findings>
            {checks.map((check) => (
              <Finding key={check.id}>
                <Badge
                  color={CHECK_LEVEL_META[check.level].color}
                  variant="light"
                  size="sm"
                  tt="none"
                  flex="none"
                >
                  {CHECK_LEVEL_META[check.level].label}
                </Badge>
                <Text component="span" inherit>
                  {check.title}
                </Text>
              </Finding>
            ))}
          </Findings>
        </DetailSection>
      )}
      <ElementLinks
        title="Speaks in"
        ids={uses}
        cards={cards}
        onSelect={onSelect}
      />
      {flows.length > 0 && (
        <DetailSection title="Flow inferred from types">
          <Findings>
            {flows.map((flow) => (
              <Finding key={`${flow.direction}:${flow.type}:${flow.other.id}`}>
                <Text
                  component="span"
                  flex="none"
                  w="3.5rem"
                  fz="xs"
                  fw={600}
                  c="var(--noesis-secondary-text)"
                >
                  {flow.direction === 'gives' ? 'gives' : 'takes'}
                </Text>
                <Text component="span" inherit>
                  <Code bg="transparent" p={0}>
                    {nameOf(flow.type)}
                  </Code>
                  {flow.direction === 'gives' ? ' to ' : ' from '}
                  {`${flow.other.owner}.${flow.other.name}`}
                  {flow.typeMatchOnly && (
                    <Text
                      component="span"
                      inherit
                      fs="italic"
                      c="var(--noesis-secondary-text)"
                    >
                      {' · type match only'}
                    </Text>
                  )}
                </Text>
              </Finding>
            ))}
          </Findings>
        </DetailSection>
      )}
    </>
  );
}

/** A list of findings, one to a line. */
function Findings({ children }: { children: ReactNode }) {
  return (
    <Stack component="ul" gap={6} m={0} p={0} fz="sm" className={classes.list}>
      {children}
    </Stack>
  );
}

/** One finding: its mark, then what it says, on one baseline. */
function Finding({ children }: { children: ReactNode }) {
  return (
    <Group component="li" align="baseline" gap="xs" wrap="nowrap">
      {children}
    </Group>
  );
}
