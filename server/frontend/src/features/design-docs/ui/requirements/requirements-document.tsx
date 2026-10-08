import { IconAlertCircle } from '@tabler/icons-react';
import type { ReactNode, Ref } from 'react';
import { plural } from '#/features/design-docs/ui/plural.ts';
import { Box } from '#/shared/design-system/box.tsx';
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
import { type EntryMark, entryMark } from './entry-mark.ts';
import { RuleEntry } from './rule-entry.tsx';
import { Remark, Statement } from './statement.tsx';
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

  return (
    <Stack ref={ref} gap={0} px="lg" pt="lg" className={classes.page}>
      <Summary summary={requirements.summary} />

      {requirements.needs.map(({ need, rules }) => (
        <Section key={need.id} {...mark(needPath(need.id))}>
          <SectionHead>
            <Title order={2} size="h3">
              {needNameOf(need)}
            </Title>
            <NeedBody need={need} />
          </SectionHead>
          {rules.length > 0 ? (
            rules.map((traced) => entry(traced, needPath(need.id)))
          ) : (
            <Text c="dimmed" mt="sm">
              No rule of this design answers this need.
            </Text>
          )}
        </Section>
      ))}

      <Section {...mark(DESIGN_DECISIONS_PATH)}>
        <SectionHead>
          <Title order={2} size="h3">
            {DESIGN_DECISIONS_TITLE}
          </Title>
          <Remark>Rules the design adds that no need asks for.</Remark>
        </SectionHead>
        {requirements.designDecisions.length > 0 ? (
          requirements.designDecisions.map((traced) =>
            entry(traced, DESIGN_DECISIONS_PATH),
          )
        ) : (
          <Text c="dimmed" mt="sm">
            Every rule of this design answers a need.
          </Text>
        )}
      </Section>

      <Section {...mark(UNADDRESSED_NEEDS_PATH)}>
        <SectionHead gap={requirements.unaddressedNeeds.length > 0}>
          <Title order={2} size="h3">
            {UNADDRESSED_NEEDS_TITLE}
          </Title>
          <Remark>Needs no rule of this design traces to.</Remark>
        </SectionHead>
        {requirements.unaddressedNeeds.length > 0 ? (
          requirements.unaddressedNeeds.map((need) => (
            <Box
              key={need.id}
              className={classes.rule}
              py="md"
              {...mark(needPath(need.id, UNADDRESSED_NEEDS_PATH))}
            >
              <Title order={3} size="h5">
                {needNameOf(need)}
              </Title>
              <NeedBody need={need} />
            </Box>
          ))
        ) : (
          <Text c="dimmed" mt="sm">
            Every need has a rule that answers it.
          </Text>
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
}: {
  children: ReactNode;
  gap?: boolean;
}) {
  return (
    <Box pb="sm" className={classes.sectionHead} data-gap={gap || undefined}>
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

function NeedBody({ need }: { need: DesignedNeedInput }) {
  const statement = valueOf(need.statement);
  const stakeholder = valueOf(need.stakeholder);
  return (
    <>
      {statement !== null && <Statement>{statement}</Statement>}
      {stakeholder !== null && (
        <Remark>
          Stakeholder:{' '}
          <Text span inherit fw={700}>
            {stakeholder}
          </Text>
        </Remark>
      )}
    </>
  );
}
