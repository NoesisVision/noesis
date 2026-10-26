import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import { DataList } from '#/shared/design-system/data-list.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import {
  RULE_PLACE_KIND,
  type TracedRule,
} from '../../design-doc-requirements.ts';
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
export function ElementLink({
  traced,
  changeId,
  docId,
  bare = false,
}: ElementLinkProps & {
  /** The name alone, in a line that already says what it is. */
  bare?: boolean;
}) {
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
      {!bare && (
        <Text span ml={6} fz="xs" c="var(--noesis-secondary-text)">
          {RULE_PLACE_KIND[element.kind]}
        </Text>
      )}
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
