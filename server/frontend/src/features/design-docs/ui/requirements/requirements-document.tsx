import { IconAlertCircle } from '@tabler/icons-react';
import { type ReactNode, type Ref, useState } from 'react';
import { plural } from '#/features/design-docs/ui/plural.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { FloatingIndicator } from '#/shared/design-system/floating-indicator.tsx';
import { useMergedRef } from '#/shared/design-system/hooks.ts';
import { List } from '#/shared/design-system/list.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignedNeedInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import {
  DESIGN_DECISIONS_PATH,
  DESIGN_DECISIONS_TITLE,
  needNameOf,
  needPath,
  REQUIREMENTS_SUMMARY,
  type RequirementsOutline,
  type RequirementsSummary,
  rulePath,
  type TracedRule,
  UNADDRESSED_NEEDS_PATH,
  UNADDRESSED_NEEDS_TITLE,
} from '../../design-doc-requirements.ts';
import type { DesignDocDetail } from '../../design-docs.api.ts';
import { scenarioEntriesOf } from '../element-details/body/scenarios-of.ts';
import { type EntryMark, type EntryPin, entryMark } from './entry-mark.ts';
import { RuleEntry } from './rule-entry.tsx';
import { Remark } from './statement.tsx';
import classes from './requirements-view.module.css';

/** The requirements as a page to read down: what is asked, then what answers it. */
export function RequirementsDocument({
  ref,
  changeId,
  document: doc,
  requirements,
  selected,
}: {
  ref: Ref<HTMLDivElement>;
  changeId: string;
  document: DesignDocDetail['document'];
  requirements: RequirementsOutline;
  selected: string | null;
}) {
  const [page, setPage] = useState<HTMLDivElement | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const pageRef = useMergedRef(ref, setPage);
  const entry = (traced: TracedRule, under: string) => {
    const path = rulePath(traced, under);
    return (
      <RuleEntry
        key={path}
        path={path}
        selected={selected === path}
        traced={traced}
        changeId={changeId}
        docId={doc.id}
      />
    );
  };
  const mark = (path: string) => entryMark(path, selected === path);
  // A section is drawn by its heading: its rules are entries of their own.
  const pin = (path: string) => (selected === path ? setTarget : undefined);

  return (
    <Stack ref={pageRef} gap={0} px="lg" pt="lg" className={classes.page}>
      {/* The heading in hand, lifted on a card that slides to it from the
          last one: a need's or a group's. A rule is a card of its own, and
          is outlined instead. */}
      <FloatingIndicator
        target={target}
        parent={page}
        className={classes.indicator}
      />
      <Summary summary={requirements.summary} />

      {requirements.needs.map(({ need, rules }) => (
        <Section key={need.id} {...mark(needPath(need.id))}>
          <SectionHead pin={pin(needPath(need.id))}>
            <NeedEyebrow need={need} />
            <Title order={2} className={classes.needName}>
              {needNameOf(need)}
            </Title>
            <NeedStatement need={need} />
            {rules.length > 0 && <Coverage rules={rules} />}
          </SectionHead>
          <Box className={classes.rulesLabel}>Rules</Box>
          {rules.length > 0 ? (
            <Box className={classes.rules}>
              {rules.map((traced) => entry(traced, needPath(need.id)))}
            </Box>
          ) : (
            <Box className={classes.rules}>
              <Text className={classes.emptyCard}>
                No rule of this design answers this need.
              </Text>
            </Box>
          )}
        </Section>
      ))}

      <Section {...mark(DESIGN_DECISIONS_PATH)}>
        <SectionHead pin={pin(DESIGN_DECISIONS_PATH)}>
          <Title order={2} size="h3">
            {DESIGN_DECISIONS_TITLE}
          </Title>
          <Remark>Rules the design adds that no need asks for.</Remark>
        </SectionHead>
        {requirements.designDecisions.length > 0 ? (
          <Box className={classes.rules}>
            {requirements.designDecisions.map((traced) =>
              entry(traced, DESIGN_DECISIONS_PATH),
            )}
          </Box>
        ) : (
          <Box className={classes.rules}>
            <Text className={classes.emptyCard}>
              Every rule of this design answers a need.
            </Text>
          </Box>
        )}
      </Section>

      <Section {...mark(UNADDRESSED_NEEDS_PATH)}>
        <SectionHead
          pin={pin(UNADDRESSED_NEEDS_PATH)}
          gap={requirements.unaddressedNeeds.length > 0}
        >
          <Title order={2} size="h3">
            {UNADDRESSED_NEEDS_TITLE}
          </Title>
          <Remark>Needs no rule of this design traces to.</Remark>
        </SectionHead>
        {requirements.unaddressedNeeds.length > 0 ? (
          <Box className={classes.rules}>
            {requirements.unaddressedNeeds.map((need) => (
              <Box
                key={need.id}
                component="article"
                className={classes.rule}
                {...entryMark(
                  needPath(need.id, UNADDRESSED_NEEDS_PATH),
                  selected === needPath(need.id, UNADDRESSED_NEEDS_PATH),
                )}
              >
                <Box component="header" className={classes.ruleHead}>
                  <NeedEyebrow need={need} />
                  <Title
                    order={3}
                    className={`${classes.ruleName} ${classes.entryTitle}`}
                  >
                    {needNameOf(need)}
                  </Title>
                </Box>
                <Box className={classes.cardBody}>
                  <NeedStatement need={need} small />
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Box className={classes.rules}>
            <Text className={classes.emptyCard}>
              Every need has a rule that answers it.
            </Text>
          </Box>
        )}
      </Section>
    </Stack>
  );
}

/** A part of the document: a need with its rules, or one of the two groups it closes on. */
function Section({ children, ...mark }: { children: ReactNode } & EntryMark) {
  return (
    <Box component="section" mt="xl" className={classes.section} {...mark}>
      {children}
    </Box>
  );
}

/** A section's heading and what is said under it, ruled off from its entries; a gap's in the gap colour. */
function SectionHead({
  children,
  gap = false,
  pin,
}: {
  children: ReactNode;
  gap?: boolean;
  /** Hands the heading, while its section is in hand, to the card under it. */
  pin?: EntryPin;
}) {
  return (
    <Box ref={pin} className={classes.sectionHead} data-gap={gap || undefined}>
      {children}
    </Box>
  );
}

/** The counts a reviewer reads first; a gap above zero is marked by an icon as well as colour. */
function Summary({ summary }: { summary: RequirementsSummary }) {
  return (
    <List
      mt="sm"
      ps={0}
      fz="sm"
      c="var(--noesis-secondary-text)"
      listStyleType="none"
      classNames={{ root: classes.summary, itemLabel: classes.count }}
    >
      {REQUIREMENTS_SUMMARY.map(({ key, one, many, gap }) => {
        const count = summary[key];
        const marked = gap && count > 0;
        return (
          <List.Item key={key} data-gap={marked || undefined}>
            {marked && <IconAlertCircle size={14} aria-hidden />}
            <Text span inherit fw={700} className={classes.number}>
              {count}
            </Text>{' '}
            {plural(count, one, many)}
          </List.Item>
        );
      })}
    </List>
  );
}

/** "Need · Stakeholder X": what the section is, and who asks it. */
function NeedEyebrow({ need }: { need: DesignedNeedInput }) {
  const stakeholder = valueOf(need.stakeholder);
  return (
    <Text className={classes.needEyebrow}>
      <Text span inherit className={classes.needKind}>
        Need
      </Text>
      {/* A need whose sources name nobody says so by saying nothing. */}
      {stakeholder !== null && stakeholder.trim() !== '' && (
        <>
          {' · Stakeholder '}
          <Text span inherit fw={600} c="var(--mantine-color-text)">
            {stakeholder}
          </Text>
        </>
      )}
    </Text>
  );
}

/** What the need asks, as the paragraph the section opens on. */
function NeedStatement({
  need,
  small = false,
}: {
  need: DesignedNeedInput;
  /** In a card of its own rather than heading a section. */
  small?: boolean;
}) {
  const statement = valueOf(need.statement);
  if (statement === null) return null;
  return (
    <Text className={classes.needStatement} data-small={small || undefined}>
      {statement}
    </Text>
  );
}

/**
 * How many of the need's rules a scenario verifies, in words and as a bar:
 * the words carry it, the bar and its colour only repeat them. A rule the
 * design removes is not counted.
 */
function Coverage({ rules }: { rules: TracedRule[] }) {
  const counted = rules.filter((traced) => traced.change !== 'removed');
  if (counted.length === 0) return null;
  const verified = counted.filter(
    ({ rule }) => rule !== null && scenarioEntriesOf(rule.scenarios).length > 0,
  ).length;
  const complete = verified === counted.length;
  return (
    <Box className={classes.coverage} data-complete={complete || undefined}>
      <Text span fw={600}>
        {counted.length} {plural(counted.length, 'rule', 'rules')}
      </Text>
      <Text span c="var(--noesis-secondary-text)" aria-hidden>
        ·
      </Text>
      <Text span fw={600} className={classes.coverageVerified}>
        {verified} verified by a scenario
      </Text>
      <Box className={classes.coverageBar} aria-hidden>
        <Box
          className={classes.coverageFill}
          style={{ width: `${(verified / counted.length) * 100}%` }}
        />
      </Box>
    </Box>
  );
}
