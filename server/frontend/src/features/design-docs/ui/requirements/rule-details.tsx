import { IconChevronRight } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useId, useState } from 'react';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { OutlineKind } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignedRuleInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import type { TracedRule } from '../../design-doc-requirements.ts';
import { ChangeBadge } from '../element-details/change-badge.tsx';
import { classificationOf } from '../element-details/change-list-items.ts';
import { FieldList } from '../field-list.tsx';
import { TracedNeeds } from '../traced-needs.tsx';
import classes from './requirements-view.module.css';

export interface ElementLinkProps {
  traced: TracedRule;
  changeId: string;
  docId: string;
}

const KIND_LABEL: Partial<Record<OutlineKind, string>> = {
  module: 'module',
  building_block: 'building block',
  behaviour: 'behaviour',
};

/** The element a rule is on, opened in the model view with it in hand. */
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
            search={{ node: element.id }}
          />
        )}
      >
        {element.name}
      </Anchor>
      <span className={classes.kind}>{KIND_LABEL[element.kind]}</span>
    </>
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
  const trace = traced.trace ?? [];
  const changed =
    traced.change === 'modified' &&
    (classification !== null || rationale !== null || traced.trace !== null);

  return (
    <div className={classes.details}>
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
        <span className={classes.toggleLabel}>Details</span>
        <span className={classes.peek}>
          {[
            valueOf(rule.category),
            `${traced.module.name} › ${traced.element.name}`,
          ]
            .filter((word) => word !== null)
            .join(' · ')}
        </span>
        {changed && (
          <ChangeBadge change="modified" inline>
            changed
          </ChangeBadge>
        )}
      </UnstyledButton>
      <FieldList id={id} hidden={!open} className={classes.fields}>
        {classification !== null && (
          <>
            <dt>Category</dt>
            <dd>{classification}</dd>
          </>
        )}
        <dt>Subsystem</dt>
        <dd>{traced.module.name}</dd>
        <dt>Element</dt>
        <dd>{element}</dd>
        {rationale !== null && (
          <>
            <dt>Rationale</dt>
            <dd>{rationale}</dd>
          </>
        )}
        {trace.length > 0 && (
          <>
            <dt>Needs</dt>
            <dd>
              <TracedNeeds needs={trace} />
            </dd>
          </>
        )}
      </FieldList>
    </div>
  );
}
