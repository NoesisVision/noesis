import { IconAlertCircle } from '@tabler/icons-react';
import type { Ref } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { plural } from '#/shared/ui/plural.ts';
import type { DesignedNeedInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import {
  DESIGN_DECISIONS_PATH,
  needNameOf,
  needPath,
  type RequirementsOutline,
  type RequirementsSummary,
  rulePath,
  type TracedRule,
  UNADDRESSED_NEEDS_PATH,
} from '../../design-doc-requirements.ts';
import type { DesignDocDetail } from '../../design-docs.api.ts';
import { RuleEntry } from './rule-entry.tsx';
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
  const mark = (path: string) => ({
    'data-entry': path,
    'data-selected': selected === path || undefined,
  });

  return (
    <div ref={ref} className={classes.page}>
      {doc.description !== '' && (
        <Text className={classes.intro}>{doc.description}</Text>
      )}
      <Summary summary={requirements.summary} />

      {requirements.needs.map(({ need, rules }) => (
        <section
          key={need.id}
          className={classes.section}
          {...mark(needPath(need.id))}
        >
          <div className={classes.sectionHead}>
            <Title order={2} size="h3">
              {needNameOf(need)}
            </Title>
            <NeedBody need={need} />
          </div>
          {rules.length > 0 ? (
            rules.map((traced) => entry(traced, needPath(need.id)))
          ) : (
            <Text c="dimmed" mt="sm">
              No rule of this design answers this need.
            </Text>
          )}
        </section>
      ))}

      <section className={classes.section} {...mark(DESIGN_DECISIONS_PATH)}>
        <div className={classes.sectionHead}>
          <Title order={2} size="h3">
            Design decisions
          </Title>
          <Text className={classes.note}>
            Rules the design adds that no need asks for.
          </Text>
        </div>
        {requirements.designDecisions.length > 0 ? (
          requirements.designDecisions.map((traced) =>
            entry(traced, DESIGN_DECISIONS_PATH),
          )
        ) : (
          <Text c="dimmed" mt="sm">
            Every rule of this design answers a need.
          </Text>
        )}
      </section>

      <section className={classes.section} {...mark(UNADDRESSED_NEEDS_PATH)}>
        <div
          className={classes.sectionHead}
          data-gap={requirements.unaddressedNeeds.length > 0 || undefined}
        >
          <Title order={2} size="h3">
            Unaddressed needs
          </Title>
          <Text className={classes.note}>
            Needs no rule of this design traces to.
          </Text>
        </div>
        {requirements.unaddressedNeeds.length > 0 ? (
          requirements.unaddressedNeeds.map((need) => (
            <div
              key={need.id}
              className={classes.rule}
              {...mark(needPath(need.id, UNADDRESSED_NEEDS_PATH))}
            >
              <Title order={3} size="h5">
                {needNameOf(need)}
              </Title>
              <NeedBody need={need} />
            </div>
          ))
        ) : (
          <Text c="dimmed" mt="sm">
            Every need has a rule that answers it.
          </Text>
        )}
      </section>
    </div>
  );
}

const SUMMARY: {
  key: keyof RequirementsSummary;
  one: string;
  many: string;
  gap?: true;
}[] = [
  { key: 'needs', one: 'need', many: 'needs' },
  { key: 'rules', one: 'rule', many: 'rules' },
  { key: 'designDecisions', one: 'design decision', many: 'design decisions' },
  {
    key: 'unaddressedNeeds',
    one: 'unaddressed need',
    many: 'unaddressed needs',
    gap: true,
  },
  {
    key: 'rulesWithoutVerification',
    one: 'rule without verification',
    many: 'rules without verification',
    gap: true,
  },
];

/** The counts a reviewer reads first; a gap above zero is marked by an icon as well as colour. */
function Summary({ summary }: { summary: RequirementsSummary }) {
  return (
    <ul className={classes.summary}>
      {SUMMARY.map(({ key, one, many, gap }) => {
        const count = summary[key];
        const marked = gap === true && count > 0;
        return (
          <li key={key} data-gap={marked || undefined}>
            {marked && <IconAlertCircle size={14} aria-hidden />}
            <b>{count}</b> {plural(count, one, many)}
          </li>
        );
      })}
    </ul>
  );
}

function NeedBody({ need }: { need: DesignedNeedInput }) {
  const statement = valueOf(need.statement);
  const stakeholder = valueOf(need.stakeholder);
  return (
    <>
      {statement !== null && (
        <blockquote className={classes.quote}>{statement}</blockquote>
      )}
      {stakeholder !== null && (
        <Text className={classes.meta}>
          Stakeholder: <b>{stakeholder}</b>
        </Text>
      )}
    </>
  );
}
