import { describe, expect, it } from 'bun:test';
import {
  requirementsOf,
  requirementsTreeOf,
} from '../src/features/design-docs/design-doc-requirements';
import { requirementsFixture } from './fixtures/design-doc-requirements.fixture';

const outline = requirementsOf(requirementsFixture);
const rulesOf = (need: string) =>
  outline.needs
    .find((entry) => entry.need.id === need)
    ?.rules.map(({ name }) => name);

describe('requirementsOf', () => {
  it('groups the rules under the needs they answer, in the order of the model view', () => {
    expect(outline.needs.map(({ need }) => need.id)).toEqual([
      'refund-single-lines',
      'see-what-was-refunded',
      'audit-refunds',
    ]);
    expect(rulesOf('refund-single-lines')).toEqual([
      'Refund never exceeds paid amount',
      'A refund is issued within a second',
    ]);
  });

  it('lists a rule under each need it answers', () => {
    expect(rulesOf('see-what-was-refunded')).toContain(
      'Refund never exceeds paid amount',
    );
    expect(rulesOf('refund-single-lines')).toContain(
      'Refund never exceeds paid amount',
    );
  });

  it('sets apart the rules no need asks for as design decisions', () => {
    expect(outline.designDecisions.map(({ name }) => name)).toEqual([
      'Paid orders are final',
      'Only paid orders are refundable',
    ]);
  });

  it('lists the needs no rule answers', () => {
    expect(outline.unaddressedNeeds.map(({ id }) => id)).toEqual([
      'audit-refunds',
    ]);
  });

  it('reads the rules of a module, the module being their element and their subsystem', () => {
    const rule = outline.needs[0]?.rules.find(
      ({ name }) => name === 'A refund is issued within a second',
    );
    expect(rule?.element).toEqual({
      id: 'module|sales.refunds',
      name: 'refunds',
      kind: 'module',
    });
    expect(rule?.module).toEqual({
      id: 'module|sales.refunds',
      name: 'refunds',
    });
  });

  it('places a behaviour rule in the module its building block sits in', () => {
    const rule = outline.designDecisions.find(
      ({ name }) => name === 'Only paid orders are refundable',
    );
    expect(rule?.element).toEqual({
      id: 'behavior|sales.refunds.Refund.issue',
      name: 'issue',
      kind: 'behaviour',
    });
    expect(rule?.module.name).toBe('refunds');
  });

  it('carries a modified rule with the trace the design gives it', () => {
    const rule = outline.needs[1]?.rules[0];
    expect(rule?.change).toBe('modified');
    expect(rule?.trace).toEqual(['See what was refunded']);
  });

  it('keeps a removed rule by its name, on its element', () => {
    const rule = outline.designDecisions[0];
    expect(rule?.change).toBe('removed');
    expect(rule?.rule).toBeNull();
    expect(rule?.element.name).toBe('Order');
  });

  it('names an element and its module the document only implies', () => {
    // Neither `Order` nor `sales.orders` is written out beyond the id.
    const rule = outline.needs[1]?.rules[0];
    expect(rule?.element.name).toBe('Order');
    expect(rule?.module).toEqual({ id: 'module|sales.orders', name: 'orders' });
  });

  describe('summary', () => {
    it('counts every rule once, however many needs it answers, and no removed one', () => {
      expect(outline.summary.rules).toBe(4);
      expect(outline.summary.designDecisions).toBe(1);
    });

    it('counts the needs and the gaps', () => {
      expect(outline.summary.needs).toBe(3);
      expect(outline.summary.unaddressedNeeds).toBe(1);
    });

    it('counts an added rule with no scenario as without verification, not a modified one', () => {
      expect(outline.summary.rulesWithoutVerification).toBe(1);
    });
  });

  it('reads a document without needs as design decisions alone', () => {
    const { needs: _, ...rest } = requirementsFixture;
    const bare = requirementsOf(rest);
    expect(bare.needs).toEqual([]);
    expect(bare.designDecisions).toHaveLength(5);
    expect(bare.summary.designDecisions).toBe(4);
  });
});

describe('requirementsTreeOf', () => {
  const tree = requirementsTreeOf(outline, requirementsFixture);
  const row = (path: string) => tree.find((node) => node.path === path);
  const childrenOf = (path: string) =>
    tree.filter((node) => node.parentPath === path).map(({ name }) => name);

  it('roots each need, then the design decisions and the unaddressed needs', () => {
    expect(
      tree.filter((node) => node.parentPath === null).map(({ name }) => name),
    ).toEqual([
      'Refund single lines',
      'See what was refunded',
      'Audit refunds',
      'Design decisions',
      'Unaddressed needs',
    ]);
  });

  it('hangs the rules under the need they answer, a shared rule under each', () => {
    expect(childrenOf('need:refund-single-lines')).toEqual([
      'Refund never exceeds paid amount',
      'A refund is issued within a second',
    ]);
    expect(childrenOf('need:see-what-was-refunded')).toContain(
      'Refund never exceeds paid amount',
    );
  });

  it('gives every row a path of its own', () => {
    expect(new Set(tree.map(({ path }) => path)).size).toBe(tree.length);
  });

  it('groups the design decisions and the unaddressed needs', () => {
    expect(childrenOf('decisions')).toEqual([
      'Paid orders are final',
      'Only paid orders are refundable',
    ]);
    expect(childrenOf('unaddressed')).toEqual(['Audit refunds']);
    expect(
      row(
        'decisions/rule:building_block|sales.orders.Order:Paid orders are final',
      )?.change,
    ).toBe('removed');
  });
});
