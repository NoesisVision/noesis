import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  applyEdit,
  draftOfUnit,
  newRuleOf,
  type PartOwner,
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

function Fields({
  kind,
  id,
  owner = null,
}: {
  kind: UnitKind;
  id: string | null;
  owner?: PartOwner | null;
}) {
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
      owner={owner}
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

  it("choose a behaviour's kind from chips, and a block's pattern from a list", () => {
    const behaviour = render(<Fields kind="behaviour" id={null} />);
    expect(behaviour).toMatch(/role="radiogroup" aria-label="Type"/);
    for (const kind of ['Command', 'Event', 'Query'])
      expect(behaviour).toContain(`<span>${kind}</span>`);
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
  const owner = { kind: 'module', id: 'module|pay' } as const;

  it('classify a rule and trace it to needs', () => {
    const html = render(<Fields kind="rule" id={null} owner={owner} />);
    // Each a chip: one category, any number of needs.
    expect(html).toMatch(/role="radiogroup" aria-label="Category"/);
    expect(html).toMatch(/<fieldset[^>]*aria-label="Answers the needs"/);
    expect(html).toContain('>Hold a card<');
    expect(html).toMatch(/aria-label="Rule type"/);
    expect(html).toMatch(/aria-label="Rationale"/);
  });

  it('type a property, which may be a collection and may be left out', () => {
    const html = render(
      <Fields
        kind="property"
        id={null}
        owner={{ kind: 'building_block', id: BLOCK }}
      />,
    );
    expect(html).toContain('A collection of it');
    expect(html).toContain('It may be left out');
  });

  it('step a scenario through given, when and then', () => {
    const html = render(
      <Fields
        kind="scenario"
        id={null}
        owner={{ kind: 'building_block', id: BLOCK }}
      />,
    );
    for (const step of ['Given', 'When', 'Then'])
      expect(html).toContain(`aria-label="${step}"`);
  });
});

const parts: DesignDocumentInput = {
  ...document,
  buildingBlocks: {
    modified: [
      {
        id: BLOCK,
        rules: {
          added: [
            {
              name: 'held once',
              category: { value: 'Business' },
              ruleType: { value: 'Consistency' },
              description: { value: 'Once.' },
              needs: { value: [] },
            },
          ],
        },
        properties: {
          added: [
            {
              name: 'amount',
              type: { value: 'primitive|decimal' },
              description: { value: 'How much.' },
              optional: { value: false },
            },
          ],
          modified: [{ name: 'currency', description: { value: 'Which.' } }],
        },
        scenarios: {
          added: [
            {
              name: 'settles',
              description: { value: '' },
              given: { value: 'a hold' },
              when: { value: 'it settles' },
              // oxlint-disable-next-line unicorn/no-thenable
              then: { value: 'it is gone' }, // NOSONAR
            },
          ],
        },
      },
    ],
    removed: ['building_block|pay.Old'],
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
const block = parts.buildingBlocks!.modified![0]!;
const editable = (html: string) =>
  [...html.matchAll(/title="Edit the ([a-z ]+)"/g)].map((match) => match[1]);

describe('a rule card', () => {
  const card = (
    <RuleCards items={ruleItems(BLOCK, block.rules)} owner={owner} />
  );

  it('writes its name, kind, description and needs in place', () => {
    const html = render(
      <UnitEditingContext.Provider value={writing}>
        {card}
      </UnitEditingContext.Provider>,
    );
    expect(editable(html)).toEqual([
      'name',
      'rule type',
      'description',
      'needs it answers',
    ]);
    expect(html).toContain('>Business · Consistency<');
    expect(html).toContain('New scenario');
  });

  it('only reads where the document is read only', () => {
    expect(editable(render(card))).toEqual([]);
  });
});

describe('a property tile', () => {
  const grid = (
    <PropertyGrid
      items={propertyItems(BLOCK, block.properties)}
      owner={owner}
    />
  );

  it("writes its description in place, and an added one's name; never its type", () => {
    const html = render(
      <UnitEditingContext.Provider value={writing}>
        {grid}
      </UnitEditingContext.Provider>,
    );
    // `amount` is added: its name too; `currency` is the model's, kept by name.
    expect(editable(html)).toEqual(['name', 'description', 'description']);
  });

  it('only reads where the document is read only', () => {
    expect(editable(render(grid))).toEqual([]);
  });
});

describe("a scenario's buttons", () => {
  const scenario = { kind: 'scenario', id: 'settles', owner } as const;

  it('edit it and delete it', () => {
    const html = render(
      <UnitEditingContext.Provider value={writing}>
        <ScenarioActions scenario={scenario} />
      </UnitEditingContext.Provider>,
    );
    expect(html).toContain('aria-label="Edit the scenario settles"');
    expect(html).toContain('aria-label="Delete the scenario settles"');
  });

  it('are none where the document is read only, or in a removed element', () => {
    expect(render(<ScenarioActions scenario={scenario} />)).toBe(render(null));
    expect(
      render(
        <UnitEditingContext.Provider value={writing}>
          <ScenarioActions
            scenario={{
              ...scenario,
              owner: { kind: 'building_block', id: 'building_block|pay.Old' },
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
        <NewRuleButton owner={owner} />
        <NewScenarioButton owner={owner} />
      </UnitEditingContext.Provider>,
    );
    expect(html).toContain('Add rule');
    expect(html).toContain('Add scenario');
  });

  it('are none where the document is read only', () => {
    expect(
      render(
        <>
          <NewRuleButton owner={owner} />
          <NewScenarioButton owner={owner} />
        </>,
      ),
    ).toBe(render(null));
  });
});

describe('a new rule', () => {
  it('is named "New rule", a name none of its rules has, and written whole', () => {
    const edit = newRuleOf(parts, owner);
    expect(edit).toMatchObject({
      op: 'add',
      ref: { kind: 'rule', id: 'New rule', owner },
      unit: {
        category: { value: 'Business' },
        ruleType: { value: 'Consistency' },
      },
    });
    const twice = applyEdit(parts, edit);
    expect(newRuleOf(twice, owner).ref.id).toBe('New rule 2');
  });

  it('is no business rule in a module', () => {
    const edit = newRuleOf(parts, { kind: 'module', id: 'module|pay' });
    expect(edit).toMatchObject({ unit: { category: { value: 'Quality' } } });
  });
});
