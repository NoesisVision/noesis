import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  draftOfUnit,
  type PartOwner,
  type UnitKind,
  type UnitRef,
  unitOf,
} from '../src/features/design-docs/design-doc-edit';
import { ChangeListSection } from '../src/features/design-docs/ui/element-details/body/sections/change-list-section';
import { DiagramSection } from '../src/features/design-docs/ui/element-details/body/sections/diagram-section';
import { DesignedField } from '../src/features/design-docs/ui/unit-editor/designed-field';
import {
  RemoveButton,
  UnitActions,
} from '../src/features/design-docs/ui/unit-editor/unit-actions';
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

describe('the actions on a unit', () => {
  const editing = { document, write: noop, remove: noop, move: noop };

  it('are nowhere the document is read only', () => {
    expect(
      render(<UnitActions unit={{ kind: 'building_block', id: BLOCK }} />),
    ).toBe(render(null));
  });

  it('are one button named for the unit', () => {
    const html = render(
      <UnitEditingContext.Provider value={editing}>
        <UnitActions unit={{ kind: 'building_block', id: BLOCK }} />
      </UnitEditingContext.Provider>,
    );
    expect(html).toContain('aria-label="Edit the building block Hold"');
  });

  it('are none on a part of a removed element', () => {
    const html = render(
      <UnitEditingContext.Provider value={editing}>
        <UnitActions
          unit={{
            kind: 'property',
            id: 'amount',
            owner: { kind: 'building_block', id: 'building_block|pay.Old' },
          }}
        />
      </UnitEditingContext.Provider>,
    );
    expect(html).toBe(render(null));
  });
});

describe('a section of an element', () => {
  const editing = { document, write: noop, remove: noop, move: noop };
  const element = { collection: 'buildingBlocks', id: BLOCK } as const;
  const rules = (
    <ChangeListSection element={element} title="Rules" kind="rule" items={[]} />
  );

  it('adds one more of what it lists from its header', () => {
    const html = render(
      <UnitEditingContext.Provider value={editing}>
        {rules}
      </UnitEditingContext.Provider>,
    );
    expect(html).toContain('aria-label="Add rule"');
  });

  it('edits the field it shows from its header', () => {
    const html = render(
      <UnitEditingContext.Provider value={editing}>
        <DiagramSection
          element={element}
          field={{ value: 'flowchart TD\n  A --> B', author: 'agent' }}
        />
      </UnitEditingContext.Provider>,
    );
    expect(html).toContain('aria-label="Edit the diagram"');
  });

  it('adds nothing where the document is read only', () => {
    expect(render(rules)).not.toContain('Add rule');
  });

  it('adds nothing to an element the design removes', () => {
    const html = render(
      <UnitEditingContext.Provider value={editing}>
        <ChangeListSection
          element={{
            collection: 'buildingBlocks',
            id: 'building_block|pay.Old',
          }}
          title="Rules"
          kind="rule"
          items={[]}
        />
      </UnitEditingContext.Provider>,
    );
    expect(html).not.toContain('Add rule');
  });
});

describe('an implemented type', () => {
  const lockable = 'building_block|pay.Lockable';
  const settleable = 'building_block|pay.Settleable';
  const withImplements: DesignDocumentInput = {
    ...document,
    buildingBlocks: {
      modified: [
        { id: BLOCK, implements: { added: [lockable], removed: [settleable] } },
      ],
    },
  };
  const editing = {
    document: withImplements,
    write: noop,
    remove: noop,
    move: noop,
  };
  const owner = { kind: 'building_block', id: BLOCK } as const;
  const button = (id: string) =>
    render(
      <UnitEditingContext.Provider value={editing}>
        <RemoveButton unit={{ kind: 'implements', id, owner }} />
      </UnitEditingContext.Provider>,
    );

  it('is removed with one small icon', () => {
    expect(button(lockable)).toContain(
      'aria-label="Remove the implemented type Lockable"',
    );
  });

  it('offers nothing once the design removes it', () => {
    expect(button(settleable)).toBe(render(null));
  });
});
