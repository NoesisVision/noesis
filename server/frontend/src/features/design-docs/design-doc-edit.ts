import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { matchesRef, updateAt } from './design-doc-change-sets.ts';
import { movedIdOf } from './design-doc-moves.ts';
import {
  contained,
  discarded,
  joined,
  placed,
  removalKeyOf,
  renamed,
  uncontained,
  withoutWithin,
  written,
} from './design-doc-transforms.ts';
import {
  type DesignDocEdit,
  isElement,
  isPart,
  type Removal,
  type UnitState,
} from './design-doc-unit.ts';

/*
 * A human's revision of a design document, one unit at a time. An edit is an
 * operation rather than a new document, so it can be applied to the newest
 * version just before it is saved: the server replaces the document whole.
 *
 * Every unit lives in a change set somewhere in the document — a need, an
 * element, a rule or a scenario at the top, and a property, an input, an
 * output or an extended type among the relations, from the element that
 * owns it — and every operation is the same wherever it is, once it has
 * found that set. A rule is written under the behavior that governs it and
 * a scenario under its rule: adding one writes the `behavior_governs_rule`
 * or `illustrates` relation that joins them.
 */

export * from './design-doc-unit.ts';
export * from './design-doc-change-sets.ts';
export * from './design-doc-transforms.ts';
export * from './design-doc-moves.ts';
export * from './design-doc-queries.ts';
export * from './design-doc-drafts.ts';
export * from './design-doc-draft-errors.ts';
export * from './design-doc-violations.ts';
export * from './design-doc-inline-edit.ts';

const REMOVALS: Record<UnitState, readonly Removal[]> = {
  added: ['discard'],
  modified: ['discard', 'removeFromSystem'],
  removed: ['restore'],
  unchanged: ['removeFromSystem'],
};

export const removalsOf = (state: UnitState): readonly Removal[] =>
  REMOVALS[state];

export function applyEdit<Doc extends DesignDocumentInput>(
  doc: Doc,
  edit: DesignDocEdit,
): Doc {
  const { ref } = edit;
  switch (edit.op) {
    case 'add': {
      const unit = placed(doc, ref, edit.unit);
      const added = updateAt(doc, ref, (set) => ({
        ...set,
        added: edit.first
          ? [unit, ...(set.added ?? [])]
          : [...(set.added ?? []), unit],
      }));
      return isElement(ref.kind)
        ? contained(added, ref.id, 'added')
        : joined(added, ref);
    }
    case 'write':
      return written(doc, ref, edit.unit);
    case 'discard':
      return discarded(doc, ref);
    case 'removeFromSystem': {
      const key = removalKeyOf(doc, ref, edit.type);
      const dropped = discarded(doc, ref);
      const removed = updateAt(
        isPart(ref.kind) ? dropped : withoutWithin(dropped, ref.id),
        ref,
        (set) => ({ ...set, removed: [...(set.removed ?? []), key] }),
      );
      return isElement(ref.kind)
        ? contained(removed, ref.id, 'removed')
        : removed;
    }
    case 'move': {
      const to = movedIdOf(ref, edit.to);
      return contained(
        renamed(uncontained(doc, ref.id, 'added'), ref.id, to),
        to,
        'added',
      );
    }
    case 'relocate':
      return joined(
        updateAt(discarded(doc, edit.from), ref, (set) => ({
          ...set,
          added: [...(set.added ?? []), edit.unit],
        })),
        ref,
      );
    case 'restore': {
      const restored = updateAt(doc, ref, (set) => ({
        ...set,
        removed: set.removed?.filter((key) => !matchesRef(ref, key)),
      }));
      return isElement(ref.kind)
        ? uncontained(restored, ref.id, 'removed')
        : restored;
    }
  }
}
