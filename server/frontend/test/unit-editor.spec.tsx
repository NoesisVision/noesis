import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  applyEdit,
  draftOfUnit,
  newRuleOf,
  type UnitKind,
  type UnitRef,
  unitOf,
} from '../src/features/design-docs/design-doc-edit';
import { PropertyGrid } from '../src/features/design-docs/ui/element-details/body/sections/property-grid';
import { RuleCards } from '../src/features/design-docs/ui/element-details/body/sections/rule-cards';
import {
  propertyItems,
  ruleItems,
} from '../src/features/design-docs/ui/element-details/change-list-items';
import { DesignedField } from '../src/features/design-docs/ui/unit-editor/designed-field';
import {
  NewRuleButton,
  NewScenarioButton,
} from '../src/features/design-docs/ui/unit-editor/new-buttons';
import { ScenarioActions } from '../src/features/design-docs/ui/unit-editor/scenario-actions';
import { UnitEditingContext } from '../src/features/design-docs/ui/unit-editor/unit-editing';
import { UnitFields } from '../src/features/design-docs/ui/unit-editor/unit-fields';
import { useForm } from '../src/shared/design-system/form';
import { MantineProvider } from '../src/shared/design-system/provider';

const BLOCK = 'building_block|pay.Hold';

const document: DesignDocumentInput = {
  id: '2026-10-05-holds',
  name: 'Holds',
  description: '',
  needs: {
    added: [
      {
        id: 'hold-a-card',
        name: { value: 'Hold a card' },
        stakeholder: { value: 'Guest' },
        statement: { value: 'A guest wants the card held.' },
      },
    ],
  },
  buildingBlocks: {
    modified: [{ id: BLOCK, type: { value: 'aggregate', author: 'agent' } }],
    removed: ['building_block|pay.Old'],
  },
};

const render = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

const noop = () => {};

describe('a designed field', () => {
  it('offers to write a field the design leaves alone', () => {
    const html = render(
      <DesignedField
        label="Definition"
        written={false}
        revisable
        author={null}
        onWrite={noop}
        onReset={noop}
      >
        <input aria-label="Definition" />
      </DesignedField>,
    );
    expect(html).toContain(
      'aria-label="Definition: unchanged — click to write"',
    );
    expect(html).not.toContain('<input');
  });

  it('shows a written field with who wrote it, and a way back to the model', () => {
    const html = render(
      <DesignedField
        label="Type"
        written
        revisable
        author="agent"
        error="Choose a type."
        onWrite={noop}
        onReset={noop}
      >
        <input aria-label="Type" />
      </DesignedField>,
    );
    expect(html).toContain('<input aria-label="Type"');
    expect(html).toContain('AI-generated');
    expect(html).toContain('aria-label="Keep the type the model has"');
    expect(html).toContain('Choose a type.');
  });

  it('is a plain input in a new unit', () => {
    const html = render(
      <DesignedField
        label="Name"
        written
        revisable={false}
        author="human"
        onWrite={noop}
        onReset={noop}
      >
        <input aria-label="Name" />
      </DesignedField>,
    );
    expect(html).not.toContain('Keep the name');
    expect(html).not.toContain('Written by a human');
  });
});

function Fields({ kind, id }: { kind: UnitKind; id: string | null }) {
  const original =
    id === null ? null : unitOf(document, { kind, id } as UnitRef);
  const state = id === null ? 'added' : 'modified';
  const form = useForm({
    initialValues: draftOfUnit(kind, original, state),
  });
  return (
    <UnitFields
      kind={kind}
      form={form}
      original={original}
      state={state}
      document={document}
      newNeed={kind === 'need' && id === null}
    />
  );
}

describe('the fields of a unit', () => {
  it('are the ones its kind has', () => {
    const html = render(<Fields kind="building_block" id={BLOCK} />);
    expect(html).toContain('Definition: unchanged — click to write');
    expect(html).toContain('Name: unchanged — click to write');
    // The type is written, so it is the input itself.
    expect(html).toContain('value="Aggregate"');
  });

  it("choose a block's pattern from a list, and give a behavior none", () => {
    const behavior = render(<Fields kind="behavior" id={null} />);
    expect(behavior).not.toMatch(/aria-label="Type"/);
    expect(render(<Fields kind="building_block" id={null} />)).toMatch(
      /role="combobox"[^>]*>|aria-label="Type"[^>]*role="combobox"/,
    );
  });

  it('give a new need an id to choose', () => {
    const html = render(<Fields kind="need" id={null} />);
    expect(html).toMatch(/aria-label="Name"/);
    expect(html).toMatch(/aria-label="Statement"/);
    expect(html).toContain('Id');
  });
});

describe('the fields of a part', () => {
  it('give a rule its kind and trace it to needs', () => {
    const html = render(<Fields kind="rule" id={null} />);
    // One kind from a list, any number of needs as chips.
    expect(html).toMatch(/aria-label="Kind"/);
    expect(html).not.toMatch(/aria-label="Category"/);
    expect(html).toMatch(/<fieldset[^>]*aria-label="Answers the needs"/);
    expect(html).toContain('>Hold a card<');
    expect(html).toMatch(/aria-label="Rationale"/);
  });

  it('type a property and say how many of the type it holds', () => {
    const html = render(<Fields kind="property" id={null} />);
    expect(html).toMatch(/aria-label="Type"/);
    expect(html).toMatch(/aria-label="How many"/);
    expect(html).not.toContain('A collection of it');
  });

  it('name a collaborator and the block it works with, with no count', () => {
    const html = render(<Fields kind="collaborator" id={null} />);
    expect(html).toMatch(/aria-label="Name"/);
    expect(html).toMatch(/aria-label="Has collaborator"/);
    expect(html).not.toMatch(/aria-label="How many"/);
  });

  it('starts a new scenario at given, when and then, each a step to switch, remove or add one after', () => {
    const html = render(<Fields kind="scenario" id={null} />);
    ['Given', 'When', 'Then'].forEach((keyword, index) => {
      expect(html).toContain(`aria-label="Step ${index + 1}, ${keyword}"`);
      expect(html).toContain(
        `aria-label="Step ${index + 1}, ${keyword}: change its kind"`,
      );
      expect(html).toContain(`aria-label="Remove step ${index + 1}"`);
    });
    // A step goes in between any two, but there is nothing after the last.
    expect(html).toContain('aria-label="Add a step after step 1"');
    expect(html).toContain('aria-label="Add a step after step 2"');
    expect(html).not.toContain('aria-label="Add a step after step 3"');
    expect(html).toContain('>Add step<');
  });
});

const SETTLE = 'behavior|pay.Hold.settle';
const RULE = 'rule|pay.held once';
const SCENARIO = 'scenario|pay.held once.settles';
const parts: DesignDocumentInput = {
  ...document,
  behaviors: { modified: [{ id: SETTLE }] },
  rules: {
    added: [
      {
        id: RULE,
        name: { value: 'held once' },
        kind: { value: 'validation' },
        description: { value: 'Once.' },
        needs: { value: [] },
      },
    ],
    removed: ['rule|pay.gone'],
  },
  scenarios: {
    added: [
      {
        id: SCENARIO,
        name: { value: 'settles' },
        description: { value: '' },
        steps: {
          value: [
            { kind: 'given', text: 'a hold' },
            { kind: 'when', text: 'it settles' },
            { kind: 'then', text: 'it is gone' },
          ],
        },
      },
    ],
  },
  relations: {
    added: [
      {
        kind: 'has_state',
        from: BLOCK,
        name: 'amount',
        to: { value: 'primitive|decimal' },
        cardinality: { value: '1' },
      },
      { kind: 'governs', from: SETTLE, to: RULE },
      { kind: 'illustrates', from: SCENARIO, to: RULE },
    ],
    modified: [
      {
        kind: 'has_state',
        from: BLOCK,
        name: 'currency',
        cardinality: { value: '0..1' },
      },
    ],
  },
};
const writing = {
  document: parts,
  write: noop,
  remove: noop,
  move: noop,
  saveFields: async () => null,
  apply: async () => null,
};
const owner = { kind: 'building_block', id: BLOCK } as const;
const settle = { kind: 'behavior', id: SETTLE } as const;
const editable = (html: string) =>
  [...html.matchAll(/data-edit="([a-z ]+)"/g)].map((match) => match[1]);

describe('a rule card', () => {
  const card = <RuleCards items={ruleItems(parts, SETTLE)} owner={settle} />;

  it('writes its name, kind, description and needs in place', () => {
    const html = render(
      <UnitEditingContext.Provider value={writing}>
        {card}
      </UnitEditingContext.Provider>,
    );
    expect(editable(html)).toEqual([
      'name',
      'kind',
      'description',
      'needs it answers',
    ]);
    expect(html).toContain('>Validation<');
    expect(html).toContain('New scenario');
  });

  it('only reads where the document is read only', () => {
    expect(editable(render(card))).toEqual([]);
  });
});

describe('a property tile', () => {
  const grid = (
    <PropertyGrid items={propertyItems(parts, BLOCK)} owner={owner} />
  );

  it("writes an added one's name in place; never its type, nor the name the model knows it by", () => {
    const html = render(
      <UnitEditingContext.Provider value={writing}>
        {grid}
      </UnitEditingContext.Provider>,
    );
    // `amount` is added: its name; `currency` is the model's, kept by name.
    expect(editable(html)).toEqual(['name']);
  });

  it('only reads where the document is read only', () => {
    expect(editable(render(grid))).toEqual([]);
  });
});

describe("a scenario's buttons", () => {
  const scenario = {
    kind: 'scenario',
    id: SCENARIO,
    owner: { ...settle, rule: RULE },
  } as const;

  it('edit it and delete it', () => {
    const html = render(
      <UnitEditingContext.Provider value={writing}>
        <ScenarioActions scenario={scenario} />
      </UnitEditingContext.Provider>,
    );
    expect(html).toContain('aria-label="Edit the scenario settles"');
    expect(html).toContain('aria-label="Delete the scenario settles"');
  });

  it('are none where the document is read only, or under a removed rule', () => {
    expect(render(<ScenarioActions scenario={scenario} />)).toBe(render(null));
    expect(
      render(
        <UnitEditingContext.Provider value={writing}>
          <ScenarioActions
            scenario={{
              ...scenario,
              id: 'scenario|pay.gone.lapses',
              owner: { ...settle, rule: 'rule|pay.gone' },
            }}
          />
        </UnitEditingContext.Provider>,
      ),
    ).toBe(render(null));
  });
});

describe('the new buttons', () => {
  it('add a rule, and open a scenario on its rule', () => {
    const html = render(
      <UnitEditingContext.Provider value={writing}>
        <NewRuleButton owner={settle} />
        <NewScenarioButton owner={settle} />
      </UnitEditingContext.Provider>,
    );
    expect(html).toContain('Add rule');
    expect(html).toContain('Add scenario');
  });

  it('open no scenario where no rule is shown to put it under', () => {
    expect(
      render(
        <UnitEditingContext.Provider value={writing}>
          <NewScenarioButton owner={owner} />
        </UnitEditingContext.Provider>,
      ),
    ).toBe(render(null));
  });

  it('are none where the document is read only', () => {
    expect(
      render(
        <>
          <NewRuleButton owner={settle} />
          <NewScenarioButton owner={settle} />
        </>,
      ),
    ).toBe(render(null));
  });
});

describe('a new rule', () => {
  it('is named "New rule" in its behavior\'s module, a name no rule there has, and written whole', () => {
    const edit = newRuleOf(parts, settle);
    expect(edit).toMatchObject({
      op: 'add',
      ref: { kind: 'rule', id: 'rule|pay.New rule', owner: settle },
      unit: { name: { value: 'New rule' }, kind: { value: 'validation' } },
    });
    const twice = applyEdit(parts, edit);
    expect(newRuleOf(twice, settle).ref.id).toBe('rule|pay.New rule 2');
  });

  it('is governed by the behavior it is added under', () => {
    const next = applyEdit(parts, newRuleOf(parts, settle));
    expect(next.relations?.added).toContainEqual({
      kind: 'governs',
      from: SETTLE,
      to: 'rule|pay.New rule',
    });
  });
});
