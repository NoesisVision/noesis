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
import { valueOf } from '../src/features/design-docs/design-doc-field';

const agent = <const T>(value: T) => ({ value, author: 'agent' as const });

const MODULE = 'module|pay';
const HOLD = 'building_block|pay.Hold';
const SETTLE = 'behavior|pay.Hold.settle';
const LEDGER = 'building_block|pay.Ledger';
const HELD_ONCE = 'rule|pay.held once';

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
      },
    ],
    modified: [{ id: LEDGER, definition: agent('Books.') }],
    removed: ['building_block|pay.Old'],
  },
  behaviors: {
    added: [
      {
        id: SETTLE,
        name: agent('settle'),
        definition: agent('Settles.'),
        visibility: agent({ kind: 'private' }),
      },
    ],
  },
  rules: {
    added: [
      {
        id: HELD_ONCE,
        name: agent('held once'),
        kind: agent('validation'),
        description: agent('Once.'),
        needs: agent(['hold-a-card']),
      },
    ],
  },
  relations: {
    added: [
      { kind: 'has_output', from: SETTLE, to: HOLD, cardinality: agent('1') },
      { kind: 'governs', from: SETTLE, to: HELD_ONCE },
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
    expect(next.behaviors?.added).toEqual([]);
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
    expect(next.behaviors?.added).toEqual([]);
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
    expect(next.rules?.added?.[0]?.needs).toEqual({
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
    expect(next.behaviors?.added?.[0]?.id).toBe('behavior|pay.CardHold.settle');
    expect(next.relations?.added?.[0]).toMatchObject({
      from: 'behavior|pay.CardHold.settle',
      to: id,
    });
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
    expect(unit).toMatchObject({ id: HOLD, name: { value: 'Hold' } });
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

  it("writes a scenario's steps as many as it has, each trimmed, and refuses none or a blank one", () => {
    const target = {
      mode: 'add',
      kind: 'scenario',
      owner: { kind: 'behavior', id: SETTLE, rule: HELD_ONCE },
    } as const;
    const draft = draftOfUnit('scenario', null, 'added');
    // A new scenario starts as the classic three.
    expect(draft.fields.steps?.value.map(({ kind }) => kind)).toEqual([
      'given',
      'when',
      'then',
    ]);
    draft.fields.name = { written: true, value: 'held twice' };
    draft.fields.steps = {
      written: true,
      value: [
        { kind: 'given', text: 'a hold' },
        { kind: 'given', text: ' ' },
        { kind: 'then', text: 'it is refused' },
      ],
    };
    expect(draftErrors(doc(), target, draft)).toEqual({
      'fields.steps.value.1.text': 'Write this step, or remove it.',
    });
    draft.fields.steps = {
      written: true,
      value: [
        { kind: 'given', text: 'a hold ' },
        { kind: 'given', text: 'a second hold' },
        { kind: 'then', text: ' it is refused' },
      ],
    };
    expect(draftErrors(doc(), target, draft)).toEqual({});
    const id = idOfDraft(doc(), target, draft);
    expect(id).toBe('scenario|pay.held once.held twice');
    expect(unitFromDraft('scenario', draft, null, id)).toMatchObject({
      id,
      name: { changed: true, value: 'held twice', author: 'human' },
      steps: {
        value: [
          { kind: 'given', text: 'a hold' },
          { kind: 'given', text: 'a second hold' },
          { kind: 'then', text: 'it is refused' },
        ],
        author: 'human',
      },
    });
    draft.fields.steps = { written: true, value: [] };
    expect(draftErrors(doc(), target, draft)).toEqual({
      'fields.steps.value': 'A scenario needs at least one step.',
    });
  });
});

describe('violations', () => {
  it('fall on the field they name, and the rest are said in words', () => {
    const { fields, rest } = violationsOf(
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
    id: HELD_ONCE,
    owner: { kind: 'behavior', id: SETTLE },
  } as const;

  it('is added under a behavior, which then governs it, and goes with the relation when discarded', () => {
    const owner = {
      kind: 'behavior',
      id: 'behavior|pay.Account.post',
    } as const;
    const target = { mode: 'add', kind: 'rule', owner } as const;
    const draft = draftOfUnit('rule', null, 'added');
    draft.fields.name = { written: true, value: 'balanced' };
    draft.fields.kind = { written: true, value: 'validation' };
    draft.fields.description = { written: true, value: 'Debits meet credits.' };
    expect(draftErrors(doc(), target, draft)).toEqual({});
    // A rule is named in the module of the behavior that governs it.
    const id = idOfDraft(doc(), target, draft);
    expect(id).toBe('rule|pay.balanced');
    const ref = { kind: 'rule', id, owner } as const;
    const next = applyEdit(doc(), {
      op: 'add',
      ref,
      unit: unitFromDraft('rule', draft, null, id),
    });
    expect(next.rules?.added).toContainEqual({
      id,
      name: { changed: true, value: 'balanced', author: 'human' },
      kind: { changed: true, value: 'validation', author: 'human' },
      description: {
        changed: true,
        value: 'Debits meet credits.',
        author: 'human',
      },
      needs: { changed: true, value: [], author: 'human' },
      rationale: { changed: false },
    });
    expect(next.relations?.added).toContainEqual({
      kind: 'governs',
      from: owner.id,
      to: id,
    });
    expect(unitStateOf(next, ref)).toBe('added');
    // Discarding the rule takes the relation that joined it with it.
    const back = applyEdit(next, { op: 'discard', ref });
    expect(back.rules?.added).toEqual(doc().rules?.added);
    expect(back.relations?.added).toEqual(doc().relations?.added);
  });

  it('is added under its rule, which it then illustrates', () => {
    const SCENARIO = 'scenario|pay.held once.twice';
    const ref = {
      kind: 'scenario',
      id: SCENARIO,
      owner: { kind: 'behavior', id: SETTLE, rule: HELD_ONCE },
    } as const;
    const next = applyEdit(doc(), {
      op: 'add',
      ref,
      unit: {
        id: SCENARIO,
        name: { value: 'twice' },
        description: { value: '' },
        steps: {
          value: [
            { kind: 'given', text: 'a hold' },
            { kind: 'when', text: 'it is held again' },
            { kind: 'then', text: 'it is refused' },
          ],
        },
      },
    });
    expect(unitStateOf(next, ref)).toBe('added');
    expect(next.relations?.added).toContainEqual({
      kind: 'illustrates',
      from: SCENARIO,
      to: HELD_ONCE,
    });
    expect(unitsWithin(next, holdRule)).toBe(1);
    // The rule removed from the system takes its scenarios out of the design.
    const removed = applyEdit(next, { op: 'removeFromSystem', ref: holdRule });
    expect(removed.scenarios?.added).toEqual([]);
    expect(removed.rules?.removed).toEqual([HELD_ONCE]);
  });

  it('takes another id with its name while the design adds it, what names it following', () => {
    // A rule's name is a field of its own, written whatever the design does to it.
    expect(isEditableField(UNIT_FIELDS.rule[0]!, 'modified')).toBe(true);
    const rule = unitOf(doc(), holdRule);
    const draft = draftOfUnit('rule', rule, 'added');
    draft.fields.name = { written: true, value: 'held at most once' };
    const target = { mode: 'edit', ref: holdRule } as const;
    const id = idOfDraft(doc(), target, draft);
    expect(id).toBe('rule|pay.held at most once');
    const next = applyEdit(doc(), {
      op: 'write',
      ref: holdRule,
      unit: unitFromDraft('rule', draft, rule, id),
    });
    expect(unitStateOf(next, { ...holdRule, id })).toBe('added');
    expect(unitStateOf(next, holdRule)).toBe('unchanged');
    expect(next.relations?.added).toContainEqual({
      kind: 'governs',
      from: SETTLE,
      to: id,
    });
  });

  it('is removed from the system by its relation key, a result by its type', () => {
    const ref = {
      kind: 'result',
      id: HOLD,
      owner: { kind: 'behavior', id: 'behavior|pay.Ledger.book' },
    } as const;
    const removed = applyEdit(doc(), { op: 'removeFromSystem', ref });
    expect(removed.relations?.removed).toEqual([
      { kind: 'has_output', from: 'behavior|pay.Ledger.book', to: HOLD },
    ]);
    expect(unitStateOf(removed, ref)).toBe('removed');
    expect(
      applyEdit(removed, { op: 'restore', ref }).relations?.removed,
    ).toEqual([]);
  });

  it('is removed from the system by its relation key, a property by its name', () => {
    const ref = {
      kind: 'property',
      id: 'total',
      owner: { kind: 'building_block', id: LEDGER },
    } as const;
    const removed = applyEdit(doc(), { op: 'removeFromSystem', ref });
    expect(removed.relations?.removed).toEqual([
      { kind: 'has_state', from: LEDGER, name: 'total' },
    ]);
    expect(unitStateOf(removed, ref)).toBe('removed');
    expect(
      unitStateOf(removed, {
        ...ref,
        owner: { kind: 'building_block', id: HOLD },
      }),
    ).toBe('unchanged');
  });

  it('may be an extended type, which is all key, written from its block', () => {
    const ref = {
      kind: 'extends',
      id: 'building_block|pay.Lockable',
      owner: { kind: 'building_block', id: HOLD },
    } as const;
    const draft = draftOfUnit('extends', null, 'added');
    draft.fields.ref = { written: true, value: ref.id };
    const target = {
      mode: 'add',
      kind: 'extends',
      owner: ref.owner,
    } as const;
    const id = idOfDraft(doc(), target, draft);
    const next = applyEdit(doc(), {
      op: 'add',
      ref,
      unit: unitFromDraft('extends', draft, null, id, ref.owner),
    });
    expect(next.relations?.added).toContainEqual({
      kind: 'extends',
      from: HOLD,
      to: ref.id,
    });
    expect(unitNameOf(next, ref)).toBe('Lockable');
    expect(unitStateOf(next, ref)).toBe('added');
  });

  it('writes a property as a relation from its block, its type and how many it holds as fields', () => {
    const owner = { kind: 'building_block', id: HOLD } as const;
    const draft = draftOfUnit('property', null, 'added');
    draft.fields.name = { written: true, value: 'amount' };
    draft.fields.ref = { written: true, value: 'primitive|decimal' };
    draft.fields.cardinality = { written: true, value: '0..1' };
    const target = { mode: 'add', kind: 'property', owner } as const;
    const id = idOfDraft(doc(), target, draft);
    expect(id).toBe('amount');
    const ref = { kind: 'property', id, owner } as const;
    const next = applyEdit(doc(), {
      op: 'add',
      ref,
      unit: unitFromDraft('property', draft, null, id, owner),
    });
    expect(next.relations?.added).toContainEqual({
      kind: 'has_state',
      from: HOLD,
      name: 'amount',
      to: { changed: true, value: 'primitive|decimal', author: 'human' },
      cardinality: { changed: true, value: '0..1', author: 'human' },
    });
    expect(unitStateOf(next, ref)).toBe('added');
    // Discarding the block takes its state with it.
    const gone = applyEdit(next, {
      op: 'discard',
      ref: { kind: 'building_block', id: HOLD },
    });
    expect(gone.relations?.added).toEqual([]);
  });

  it('places a parameter added after the last the design gives the behavior, and keeps the place of one written', () => {
    const owner = { kind: 'behavior', id: SETTLE } as const;
    const parameter = (name: string) => {
      const draft = draftOfUnit('parameter', null, 'added');
      draft.fields.name = { written: true, value: name };
      draft.fields.ref = { written: true, value: HOLD };
      draft.fields.cardinality = { written: true, value: '1' };
      return draft;
    };
    const added = (document: DesignDocumentInput, name: string) =>
      applyEdit(document, {
        op: 'add',
        ref: { kind: 'parameter', id: name, owner },
        unit: unitFromDraft('parameter', parameter(name), null, name, owner),
      });
    const next = added(added(doc(), 'hold'), 'reason');
    const positions = (document: DesignDocumentInput) =>
      (document.relations?.added ?? [])
        .filter((relation) => relation.kind === 'has_input')
        .map((relation) => [relation.name, valueOf(relation.position)]);
    expect(positions(next)).toEqual([
      ['hold', 1],
      ['reason', 2],
    ]);
    // Written anew, the first keeps its place.
    const ref = { kind: 'parameter', id: 'hold', owner } as const;
    const original = unitOf(next, ref);
    const draft = draftOfUnit('parameter', original, 'added');
    draft.fields.cardinality = { written: true, value: '0..1' };
    const written = applyEdit(next, {
      op: 'write',
      ref,
      unit: unitFromDraft('parameter', draft, original, 'hold', owner),
    });
    expect(positions(written)).toEqual([
      ['hold', 1],
      ['reason', 2],
    ]);
  });

  it('is refused without a kind, or under a name its module has already', () => {
    const owner = { kind: 'behavior', id: SETTLE } as const;
    const target = { mode: 'add', kind: 'rule', owner } as const;
    const draft = draftOfUnit('rule', null, 'added');
    draft.fields.name = { written: true, value: 'fast' };
    expect(draftErrors(doc(), target, draft)).toEqual({
      'fields.kind.value': 'Choose a kind.',
    });
    draft.fields.name = { written: true, value: 'held once' };
    draft.fields.kind = { written: true, value: 'post' };
    expect(draftErrors(doc(), target, draft)).toEqual({
      'fields.name.value': 'This design already has this rule here.',
    });
  });

  it('has the violations on it laid on its fields', () => {
    const { fields } = violationsOf(holdRule, 'added', [
      {
        path: `rules.added[${HELD_ONCE}].needs[gone]`,
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
    expect(next.behaviors?.added?.[0]?.id).toBe('behavior|refunds.Hold.settle');
    expect(next.relations?.added?.[0]).toMatchObject({
      from: 'behavior|refunds.Hold.settle',
      to: moved,
    });
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
