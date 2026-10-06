import { IconChevronRight } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useId, useState } from 'react';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { DataList } from '#/shared/design-system/data-list.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import {
  changesDetails,
  classificationOf,
  RULE_PLACE_KIND,
  type TracedRule,
} from '../../design-doc-requirements.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import classes from './requirements-view.module.css';

export interface ElementLinkProps {
  traced: TracedRule;
  changeId: string;
  docId: string;
}

/**
 * The element a rule is on, opened in the model view with it in hand. Only
 * the model's place moves: the other views keep theirs for the way back.
 */
export function ElementLink({ traced, changeId, docId }: ElementLinkProps) {
  const { element } = traced;
  return (
    <>
      <Anchor
        inherit
        fw={600}
        className={classes.elementLink}
        renderRoot={(props) => (
          <Link
            {...props}
            to="/changes/$changeId/design-docs/$docId"
            params={{ changeId, docId }}
            search={(prev) => ({ ...prev, view: undefined, node: element.id })}
          />
        )}
      >
        {element.name}
      </Anchor>
      <Text span ml={6} fz="xs" c="var(--noesis-secondary-text)">
        {RULE_PLACE_KIND[element.kind]}
      </Text>
    </>
  );
}

/**
 * What is said of a rule, field by field: names in a column as wide in every
 * rule, each beside its value. Its children are `RuleField`s.
 */
export function RuleFields({
  children,
  ...props
}: {
  children: ReactNode;
  id?: string;
  hidden?: boolean;
}) {
  return (
    <DataList
      gap={6}
      mt="xs"
      mb="sm"
      classNames={{ root: classes.fields, item: classes.field }}
      {...props}
    >
      {children}
    </DataList>
  );
}

export function RuleField({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <DataList.Item>
      <DataList.ItemLabel fw={600} c="var(--noesis-secondary-text)">
        {name}
      </DataList.ItemLabel>
      <DataList.ItemValue miw={0}>{children}</DataList.ItemValue>
    </DataList.Item>
  );
}

/**
 * Where a rule lives and why it is there, collapsed: the line that opens it
 * still names its category and place, so a rule is placed without opening it.
 * A modified rule shows only the fields it changes.
 */
export function Details({
  traced,
  rule,
  element,
}: {
  traced: TracedRule;
  rule: DesignedRuleInput;
  element: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const classification = classificationOf(rule);
  const rationale = valueOf(rule.rationale);

  return (
    <Box className={classes.details} mt="xs">
      <UnstyledButton
        className={classes.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
      >
        <IconChevronRight
          size={14}
          className={classes.chevron}
          data-open={open || undefined}
          aria-hidden
        />
        <Text span inherit fw={600}>
          Details
        </Text>
        <Text span inherit fz="xs" className={classes.peek}>
          {[
            valueOf(rule.category),
            `${traced.module.name} › ${traced.element.name}`,
          ]
            .filter((word) => word !== null)
            .join(' · ')}
        </Text>
        {changesDetails(traced) && (
          <ChangeBadge change="modified" inline>
            changed
          </ChangeBadge>
        )}
      </UnstyledButton>
      <RuleFields id={id} hidden={!open}>
        {classification !== null && (
          <RuleField name="Category">{classification}</RuleField>
        )}
        <RuleField name="Module">{traced.module.name}</RuleField>
        <RuleField name="Element">{element}</RuleField>
        {rationale !== null && (
          <RuleField name="Rationale">{rationale}</RuleField>
        )}
      </RuleFields>
    </Box>
  );
}
