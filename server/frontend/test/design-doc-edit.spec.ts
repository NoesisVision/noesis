import { describe, expect, it } from 'bun:test';
import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  applyEdit,
  draftErrors,
  canMove,
  draftOfUnit,
  idOfDraft,
  moveDestinationsOf,
  movedIdOf,
  isEditableField,
  refKeyOf,
  UNIT_FIELDS,
  unitNameOf,
  unitsWithin,
  removalsOf,
  rulesTracing,
  unitFromDraft,
  unitOf,
  unitStateOf,
  violationsOf,
} from '../src/features/design-docs/design-doc-edit';

const agent = <const T>(value: T) => ({ value, author: 'agent' as const });

const MODULE = 'module|pay';
const HOLD = 'building_block|pay.Hold';
const SETTLE = 'behavior|pay.Hold.settle';
const LEDGER = 'building_block|pay.Ledger';

const doc = (): DesignDocumentInput => ({
  id: '2026-10-05-holds',
  name: 'Holds',
  description: '',
  needs: {
    added: [
      {
        id: 'hold-a-card',
        name: agent('Hold a card'),
        stakeholder: agent('Guest'),
        statement: agent('A guest wants the card held.'),
      },
    ],
  },
  modules: {
    added: [{ id: MODULE, name: agent('pay'), definition: agent('') }],
  },
  buildingBlocks: {
    added: [
      {
        id: HOLD,
        name: agent('Hold'),
        type: agent('aggregate'),
        definition: agent('A hold.'),
        rules: {
          added: [
            {
              name: 'held once',
              category: agent('Business'),
              ruleType: agent('Consistency'),
              description: agent('Once.'),
              needs: agent(['hold-a-card']),
            },
          ],
        },
      },
    ],
    modified: [{ id: LEDGER, definition: agent('Books.') }],
    removed: ['building_block|pay.Old'],
  },
  behaviours: {
    added: [
      {
        id: SETTLE,
        name: agent('settle'),
        type: agent('Command'),
        definition: agent('Settles.'),
        visibility: agent({ kind: 'private' }),
        output: {
          added: [
            { type: HOLD, description: agent(''), optional: agent(false) },
          ],
        },
      },
    ],
  },
});

describe('the state of a unit', () => {
  it('is where its change set has it', () => {
    expect(unitStateOf(doc(), { kind: 'building_block', id: HOLD })).toBe(
      'added',
    );
    expect(unitStateOf(doc(), { kind: 'building_block', id: LEDGER })).toBe(
      'modified',
    );
    expect(
      unitStateOf(doc(), {
        kind: 'building_block',
        id: 'building_block|pay.Old',
      }),
    ).toBe('removed');
    expect(unitStateOf(doc(), { kind: 'module', id: 'module|other' })).toBe(
      'unchanged',
    );
  });

  it('decides how it is taken out', () => {
    expect(removalsOf('added')).toEqual(['discard']);
    expect(removalsOf('modified')).toEqual(['discard', 'removeFromSystem']);
    expect(removalsOf('removed')).toEqual(['restore']);
    expect(removalsOf('unchanged')).toEqual(['removeFromSystem']);
  });
});

describe('an edit', () => {
  it('discards an added element with what stands under it', () => {
    const next = applyEdit(doc(), {
      op: 'discard',
      ref: { kind: 'module', id: MODULE },
    });
    expect(next.modules?.added).toEqual([]);
    expect(next.buildingBlocks?.added).toEqual([]);
    expect(next.buildingBlocks?.modified).toEqual([]);
    expect(next.buildingBlocks?.removed).toEqual([]);
    expect(next.behaviours?.added).toEqual([]);
  });

  it('discards a modification and leaves what is under it', () => {
    const next = applyEdit(doc(), {
      op: 'discard',
      ref: { kind: 'building_block', id: LEDGER },
    });
    expect(next.buildingBlocks?.modified).toEqual([]);
    expect(next.buildingBlocks?.added).toHaveLength(1);
  });

  it('removes an element from the system, and the design forgets what was under it', () => {
    const next = applyEdit(doc(), {
      op: 'removeFromSystem',
      ref: { kind: 'building_block', id: HOLD },
    });
    expect(next.buildingBlocks?.added).toEqual([]);
    expect(next.buildingBlocks?.removed).toContain(HOLD);
    expect(next.behaviours?.added).toEqual([]);
  });

  it('restores a removed element', () => {
    const next = applyEdit(doc(), {
      op: 'restore',
      ref: { kind: 'building_block', id: 'building_block|pay.Old' },
    });
    expect(next.buildingBlocks?.removed).toEqual([]);
  });

  it('untraces the rules that answered a discarded need', () => {
    expect(rulesTracing(doc(), 'hold-a-card')).toEqual(['held once']);
    const next = applyEdit(doc(), {
      op: 'discard',
      ref: { kind: 'need', id: 'hold-a-card' },
    });
    expect(next.needs?.added).toEqual([]);
    expect(next.buildingBlocks?.added?.[0]?.rules?.added?.[0]?.needs).toEqual({
      changed: true,
      value: [],
      author: 'human',
    });
  });

  it('writes an element the design left alone as a modification', () => {
    const ref = { kind: 'module', id: 'module|other' } as const;
    const next = applyEdit(doc(), {
      op: 'write',
      ref,
      unit: { id: ref.id, definition: { value: 'Other.', author: 'human' } },
    });
    expect(unitStateOf(next, ref)).toBe('modified');
  });

  it('moves a renamed added element, what is under it and what names it', () => {
    const ref = { kind: 'building_block', id: HOLD } as const;
    const target = { mode: 'edit', ref } as const;
    const original = unitOf(doc(), ref);
    const draft = draftOfUnit(
      'building_block',
      original,
      unitStateOf(doc(), ref),
    );
    draft.fields.name = { written: true, value: 'CardHold' };
    const id = idOfDraft(doc(), target, draft);
    expect(id).toBe('building_block|pay.CardHold');
    const next = applyEdit(doc(), {
      op: 'write',
      ref,
      unit: unitFromDraft('building_block', draft, original, id),
    });
    expect(next.buildingBlocks?.added?.[0]?.id).toBe(id);
    expect(next.behaviours?.added?.[0]?.id).toBe(
      'behavior|pay.CardHold.settle',
    );
    expect(next.behaviours?.added?.[0]?.output?.added?.[0]?.type).toBe(id);
  });
});

describe('a draft', () => {
  it('keeps the author of a field left as it was, and claims a changed one for the human', () => {
    const ref = { kind: 'building_block', id: HOLD } as const;
    const original = unitOf(doc(), ref);
    const draft = draftOfUnit(
      'building_block',
      original,
      unitStateOf(doc(), ref),
    );
    draft.fields.definition = { written: true, value: 'A card hold.' };
    const unit = unitFromDraft('building_block', draft, original, HOLD);
    expect(unit).toMatchObject({
      type: { value: 'aggregate', author: 'agent' },
      definition: { changed: true, value: 'A card hold.', author: 'human' },
      diagram: { changed: false },
    });
    // What the form does not edit stays.
    expect(unit).toMatchObject({ rules: { added: [{ name: 'held once' }] } });
  });

  it('leaves a field the human set back to unchanged', () => {
    const ref = { kind: 'building_block', id: LEDGER } as const;
    const original = unitOf(doc(), ref);
    const draft = draftOfUnit(
      'building_block',
      original,
      unitStateOf(doc(), ref),
    );
    draft.fields.definition = { written: false, value: 'Books.' };
    expect(
      unitFromDraft('building_block', draft, original, LEDGER),
    ).toMatchObject({
      definition: { changed: false },
    });
  });

  it('adds an element the server accepts', () => {
    const target = {
      mode: 'add',
      kind: 'building_block',
      parent: MODULE,
    } as const;
    const draft = draftOfUnit('building_block', null, 'added');
    draft.fields.name = { written: true, value: ' Refund ' };
    draft.fields.type = { written: true, value: 'entity' };
    draft.fields.definition = { written: true, value: 'A refund.' };
    expect(draftErrors(doc(), target, draft)).toEqual({});
    const id = idOfDraft(doc(), target, draft);
    expect(id).toBe('building_block|pay.Refund');
    const next = applyEdit(doc(), {
      op: 'add',
      ref: { kind: 'building_block', id },
      unit: unitFromDraft('building_block', draft, null, id),
    });
    // The fixture's own modifications have no scan to stand on; the new block breaks nothing.
    expect(
      DesignDocument.validateHumanEdited(DesignDocument.parse(next)).filter(
        ({ path }) => path.includes(id),
      ),
    ).toEqual([]);
  });

  it('writes the diagram a new element is given, and drops a blank one', () => {
    const draft = draftOfUnit('module', null, 'added');
    draft.fields.name = { written: true, value: 'billing' };
    draft.fields.diagram = { written: true, value: 'flowchart TD\n  A --> B' };
    expect(
      unitFromDraft('module', draft, null, 'module|billing'),
    ).toMatchObject({
      diagram: {
        changed: true,
        value: 'flowchart TD\n  A --> B',
        author: 'human',
      },
    });
    draft.fields.diagram = { written: true, value: '  ' };
    expect(
      unitFromDraft('module', draft, null, 'module|billing'),
    ).toMatchObject({
      diagram: { changed: false },
    });
  });

  it('opens an element the design leaves alone with every field as the model has it', () => {
    const draft = draftOfUnit('module', null, 'unchanged');
    expect(Object.values(draft.fields).every((field) => !field.written)).toBe(
      true,
    );
  });

  it('refuses a name with a separator, a missing type and a taken name', () => {
    const target = {
      mode: 'add',
      kind: 'building_block',
      parent: MODULE,
    } as const;
    const draft = draftOfUnit('building_block', null, 'added');
    draft.fields.name = { written: true, value: 'a.b' };
    expect(draftErrors(doc(), target, draft)).toEqual({
      'fields.name.value': "A name cannot contain '.' or '|'.",
      'fields.type.value': 'Choose a type.',
    });
    draft.fields.name = { written: true, value: 'Hold' };
    draft.fields.type = { written: true, value: 'entity' };
    expect(draftErrors(doc(), target, draft)).toEqual({
      'fields.name.value': 'This design already has this building block here.',
    });
  });
});

describe('violations', () => {
  it('fall on the field they name, and the rest are said in words', () => {
    const { fields, rest } = violationsOf(
      doc(),
      { kind: 'building_block', id: LEDGER },
      'modified',
      [
        {
          path: `buildingBlocks.modified[${LEDGER}].type`,
          reason: 'unknownElement',
        },
        {
          path: `buildingBlocks.modified[${LEDGER}]`,
          reason: 'unknownElement',
        },
      ],
    );
    expect(fields).toEqual({
      'fields.type.value': 'The scanned model has no such element.',
    });
    expect(rest).toEqual([
      `The scanned model has no such element. (buildingBlocks.modified[${LEDGER}])`,
    ]);
  });
});

describe('a part', () => {
  const holdRule = {
    kind: 'rule',
    id: 'held once',
    owner: { kind: 'building_block', id: HOLD },
  } as const;

  it('is written into an element the design left alone, which then modifies it and nothing else', () => {
    const ref = {
      kind: 'rule',
      id: 'balanced',
      owner: { kind: 'building_block', id: 'building_block|pay.Account' },
    } as const;
    const target = { mode: 'add', kind: 'rule', owner: ref.owner } as const;
    const draft = draftOfUnit('rule', null, 'added');
    draft.fields.name = { written: true, value: 'balanced' };
    draft.fields.category = { written: true, value: 'Business' };
    draft.fields.ruleType = { written: true, value: 'Consistency' };
    draft.fields.description = { written: true, value: 'Debits meet credits.' };
    expect(draftErrors(doc(), target, draft)).toEqual({});
    const id = idOfDraft(doc(), target, draft);
    const next = applyEdit(doc(), {
      op: 'add',
      ref,
      unit: unitFromDraft('rule', draft, null, id),
    });
    expect(next.buildingBlocks?.modified).toContainEqual({
      id: 'building_block|pay.Account',
      rules: {
        added: [
          {
            name: 'balanced',
            category: { changed: true, value: 'Business', author: 'human' },
            ruleType: { changed: true, value: 'Consistency', author: 'human' },
            description: {
              changed: true,
              value: 'Debits meet credits.',
              author: 'human',
            },
            needs: { changed: true, value: [], author: 'human' },
            rationale: { changed: false },
          },
        ],
      },
    });
    expect(unitStateOf(next, ref)).toBe('added');
    // Discarding the rule leaves the element as the model has it again.
    const back = applyEdit(next, { op: 'discard', ref });
    expect(back.buildingBlocks?.modified).toEqual(
      doc().buildingBlocks?.modified,
    );
  });

  it('is found through a rule, as a rule has its own scenarios', () => {
    const ref = {
      kind: 'scenario',
      id: 'twice',
      owner: { kind: 'building_block', id: HOLD, rule: 'held once' },
    } as const;
    const next = applyEdit(doc(), {
      op: 'add',
      ref,
      unit: {
        name: 'twice',
        description: { value: '' },
        given: { value: 'a hold' },
        when: { value: 'it is held again' },
        // oxlint-disable-next-line unicorn/no-thenable
        then: { value: 'it is refused' }, // NOSONAR
      },
    });
    expect(unitStateOf(next, ref)).toBe('added');
    expect(unitsWithin(next, holdRule)).toBe(1);
  });

  it('keeps its name while the model has it, and takes another while the design adds it', () => {
    const rule = unitOf(doc(), holdRule);
    expect(isEditableField(UNIT_FIELDS.rule[0]!, 'modified')).toBe(false);
    expect(isEditableField(UNIT_FIELDS.rule[0]!, 'added')).toBe(true);
    const draft = draftOfUnit('rule', rule, 'added');
    draft.fields.name = { written: true, value: 'held at most once' };
    const target = { mode: 'edit', ref: holdRule } as const;
    const id = idOfDraft(doc(), target, draft);
    const next = applyEdit(doc(), {
      op: 'write',
      ref: holdRule,
      unit: unitFromDraft('rule', draft, rule, id),
    });
    expect(unitStateOf(next, { ...holdRule, id })).toBe('added');
    expect(unitStateOf(next, holdRule)).toBe('unchanged');
  });

  it('is removed from the system by its key, a result by its type', () => {
    const collection = { collectionOf: HOLD };
    const ref = {
      kind: 'result',
      id: refKeyOf(collection),
      owner: { kind: 'behaviour', id: 'behavior|pay.Ledger.book' },
    } as const;
    const removed = applyEdit(doc(), { op: 'removeFromSystem', ref });
    expect(removed.behaviours?.modified).toContainEqual({
      id: 'behavior|pay.Ledger.book',
      output: { removed: [collection] },
    });
    expect(unitStateOf(removed, ref)).toBe('removed');
    expect(
      applyEdit(removed, { op: 'restore', ref }).behaviours?.modified,
    ).toEqual([]);
  });

  it('may be an implemented type, which is all key', () => {
    const ref = {
      kind: 'implements',
      id: 'building_block|pay.Lockable',
      owner: { kind: 'building_block', id: HOLD },
    } as const;
    const draft = draftOfUnit('implements', null, 'added');
    draft.fields.ref = { written: true, value: ref.id };
    const target = {
      mode: 'add',
      kind: 'implements',
      owner: ref.owner,
    } as const;
    const id = idOfDraft(doc(), target, draft);
    const next = applyEdit(doc(), {
      op: 'add',
      ref,
      unit: unitFromDraft('implements', draft, null, id),
    });
    expect(next.buildingBlocks?.added?.[0]?.implements?.added).toEqual([
      ref.id,
    ]);
    expect(unitNameOf(next, ref)).toBe('Lockable');
  });

  it('is refused a rule type outside its category, and a module a business rule', () => {
    const owner = { kind: 'module', id: MODULE } as const;
    const draft = draftOfUnit('rule', null, 'added');
    draft.fields.name = { written: true, value: 'fast' };
    draft.fields.category = { written: true, value: 'Business' };
    draft.fields.ruleType = { written: true, value: 'Performance' };
    expect(
      draftErrors(doc(), { mode: 'add', kind: 'rule', owner }, draft),
    ).toEqual({
      'fields.ruleType.value':
        'A Business rule is one of: Consistency, Structure, Computation, State change.',
      'fields.category.value': 'A module holds no business rules.',
    });
  });

  it('has the violations on it laid on its fields', () => {
    const { fields } = violationsOf(doc(), holdRule, 'added', [
      {
        path: `buildingBlocks.added[${HOLD}].rules.added[held once].needs[gone]`,
        reason: 'unknownNeed',
      },
    ]);
    expect(fields).toEqual({
      'fields.needs.value': 'It answers a need this design does not state.',
    });
  });
});

describe('moving an element', () => {
  const hold = { kind: 'building_block', id: HOLD } as const;

  it('is for one the design adds', () => {
    expect(canMove(doc(), hold)).toBe(true);
    expect(canMove(doc(), { kind: 'building_block', id: LEDGER })).toBe(false);
    expect(
      moveDestinationsOf(doc(), { kind: 'building_block', id: LEDGER }),
    ).toEqual([]);
  });

  it('goes where a parent of its kind stands, never where it is', () => {
    const next = applyEdit(doc(), {
      op: 'add',
      ref: { kind: 'module', id: 'module|refunds' },
      unit: { id: 'module|refunds', name: { value: 'refunds' } },
    });
    expect(moveDestinationsOf(next, hold)).toEqual(['module|refunds']);
    // A root module may go into another module, not to the top it is at.
    expect(
      moveDestinationsOf(next, { kind: 'module', id: 'module|refunds' }),
    ).toEqual([MODULE]);
  });

  it('takes what is under it and what names it along', () => {
    const next = applyEdit(doc(), {
      op: 'move',
      ref: hold,
      to: 'module|refunds',
    });
    const moved = movedIdOf(hold, 'module|refunds');
    expect(moved).toBe('building_block|refunds.Hold');
    expect(next.buildingBlocks?.added?.[0]?.id).toBe(moved);
    expect(next.behaviours?.added?.[0]?.id).toBe(
      'behavior|refunds.Hold.settle',
    );
    expect(next.behaviours?.added?.[0]?.output?.added?.[0]?.type).toBe(moved);
  });

  it('brings a submodule to the top', () => {
    const child = { kind: 'module', id: 'module|pay.cards' } as const;
    const next = applyEdit(
      applyEdit(doc(), {
        op: 'add',
        ref: child,
        unit: { id: child.id, name: { value: 'cards' } },
      }),
      { op: 'move', ref: child, to: null },
    );
    expect(unitStateOf(next, { kind: 'module', id: 'module|cards' })).toBe(
      'added',
    );
    expect(
      moveDestinationsOf(next, { kind: 'module', id: 'module|cards' }),
    ).toEqual([MODULE]);
  });
});
