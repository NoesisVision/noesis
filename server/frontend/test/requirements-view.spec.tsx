import { describe, expect, it } from 'bun:test';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocument } from '#backend/app/design-docs/design-doc.ts';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import { DesignDocSurface } from '../src/features/design-docs/ui/design-doc-surface';
import { RequirementsView } from '../src/features/design-docs/ui/requirements/requirements-view';
import { Details } from '../src/features/design-docs/ui/requirements/rule-details';
import { MantineProvider } from '../src/shared/design-system/provider';
import { requirementsFixture } from './fixtures/design-doc-requirements.fixture';

/** A router of its own, so the element links resolve without the app's route tree. */
async function render(
  selected: string | null = null,
  at = '/',
): Promise<string> {
  const document = DesignDocument.parse(requirementsFixture);
  const detail = { document, outline: outlineOf(document) };
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <DesignDocSurface document={detail.document}>
          <RequirementsView
            changeId="2026-01-01-refunds"
            detail={detail}
            selected={selected}
            query=""
            onSelect={() => {}}
            onQuery={() => {}}
          />
        </DesignDocSurface>
      ),
    }),
    history: createMemoryHistory({ initialEntries: [at] }),
  }) as never as { load: () => Promise<void> };
  await router.load();
  return renderToStaticMarkup(
    <MantineProvider>
      <RouterProvider router={router as never} />
    </MantineProvider>,
  );
}

const page = await render();

const headings = [...page.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map(
  ([, level, text]) => [Number(level), text?.replace(/<[^>]+>/g, '')] as const,
);

/** The markup of one rule, from its heading to the next `h2` or `h3`. */
const ruleNamed = (name: string) => {
  const start = page.indexOf(`>${name}</h3>`);
  const rest = page.slice(start + name.length);
  const end = rest.search(/<h[23][ >]/);
  return end === -1 ? rest : rest.slice(0, end);
};

describe('RequirementsView', () => {
  it('heads the page with the document, once', () => {
    const first = headings.filter(([level]) => level === 1);
    expect(first).toEqual([[1, 'Partial refunds']]);
  });

  it('heads each need, then the design decisions and the unaddressed needs', () => {
    expect(headings.filter(([level]) => level === 2)).toEqual([
      [2, 'Refund single lines'],
      [2, 'See what was refunded'],
      [2, 'Audit refunds'],
      [2, 'Design decisions'],
      [2, 'Unaddressed needs'],
    ]);
  });

  it('never skips a heading level on the way down', () => {
    for (const [index, [level]] of headings.entries()) {
      const previous = headings[index - 1]?.[0] ?? 0;
      expect(level).toBeLessThanOrEqual(previous + 1);
    }
  });

  it('lists a rule under every need it answers', () => {
    const rule = headings.filter(
      ([level, text]) =>
        level === 3 && text === 'Refund never exceeds paid amount',
    );
    expect(rule).toHaveLength(2);
  });

  it('counts the needs, the rules and the gaps under the description', () => {
    const text = page.replace(/<[^>]+>/g, '');
    expect(text).toContain('3 needs');
    expect(text).toContain('4 rules');
    expect(text).toContain('1 design decision');
    expect(text).toContain('1 unaddressed need');
    expect(text).toContain('1 rule without verification');
    // A gap above zero is marked, and not by colour alone.
    expect(page.match(/data-gap="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('says so of a rule no scenario verifies', () => {
    expect(ruleNamed('A refund is issued within a second')).toContain(
      'No scenario verifies this rule',
    );
  });

  it('reads a rule verified by its scenarios as given, when and then', () => {
    const rule = ruleNamed('Refund never exceeds paid amount');
    expect(rule).toMatch(/<h4[^>]*>.*Scenarios<\/h4>/);
    // Open on what it says: the panel is not folded away.
    expect(rule).toMatch(/aria-expanded="true"/);
    expect(rule).toContain('Refunding more than was paid');
    expect(rule).toContain('support refunds 120');
  });

  it('starts every rule with its details collapsed behind a real button', () => {
    const rule = ruleNamed('Refund never exceeds paid amount');
    const button = /<button[^>]*>/.exec(rule)?.[0] ?? '';
    expect(button).toContain('aria-expanded="false"');
    const controls = /aria-controls="([^"]+)"/.exec(button)?.[1];
    expect(rule).toMatch(new RegExp(`<dl[^>]* id="${controls}" hidden=""`));
    // Collapsed, the line still places the rule.
    expect(rule).toContain('Business · refunds › Refund');
    expect(rule).toContain('Support never pays out more than came in.');
  });

  it('shows of a modified rule what it changes, its needs left to the document', () => {
    const rule = ruleNamed('Order total counts refunds');
    expect(rule).toContain('modified');
    expect(rule).toContain('An order total subtracts what was refunded.');
    // Retraced only: the rule already stands under its need, so its details
    // neither repeat the need nor read as changed.
    expect(rule).not.toContain('>changed<');
    expect(rule).not.toMatch(/<dt[^>]*>Needs<\/dt>/);
    // It writes no category, so none is shown, and its scenarios stay the model's.
    expect(rule).not.toMatch(/<dt[^>]*>Category<\/dt>/);
    expect(rule).toContain('Scenarios unchanged');
    expect(rule).not.toContain('No scenario verifies this rule');
  });

  it('lists a removed rule with its element alone', () => {
    const rule = ruleNamed('Paid orders are final');
    expect(rule).toContain('removed');
    expect(rule).not.toContain('<button');
    expect(rule).toMatch(/<dt[^>]*>Module<\/dt><dd[^>]*>orders<\/dd>/);
  });

  it('links a rule to its element in the model view', () => {
    expect(ruleNamed('Refund never exceeds paid amount')).toContain(
      'href="/changes/2026-01-01-refunds/design-docs/2026-01-01-partial-refunds?node=building_block%7Csales.refunds.Refund"',
    );
  });

  it('keeps the other views’ places in a link to the model', async () => {
    const elsewhere = await render(
      null,
      '/?view=requirements&entry=there&arch=here',
    );
    expect(elsewhere).toContain(
      '?entry=there&amp;arch=here&amp;node=building_block%7Csales.refunds.Refund"',
    );
  });

  it('names the module in a rule’s details and marks a changed rationale, needs left out', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Details
          traced={{
            name: 'A rule',
            element: {
              id: 'building_block|a.B',
              name: 'B',
              kind: 'building_block',
            },
            module: { id: 'module|a', name: 'a' },
            change: 'modified',
            rule: {
              name: 'A rule',
              rationale: { value: 'Because.', author: 'agent' },
            },
            trace: [],
          }}
          rule={{
            name: 'A rule',
            rationale: { value: 'Because.', author: 'agent' },
          }}
          element="B"
        />
      </MantineProvider>,
    );
    expect(html).toContain('>changed<');
    expect(html).toMatch(/<dt[^>]*>Module<\/dt><dd[^>]*>a<\/dd>/);
    expect(html).toMatch(/<dt[^>]*>Rationale<\/dt><dd[^>]*>Because\.<\/dd>/);
    expect(html).not.toMatch(/<dt[^>]*>Needs<\/dt>/);
  });

  it('puts the needs and their rules in a tree beside the document', () => {
    expect(page).toContain('role="tree" aria-label="Requirements outline"');
    const row = (name: string) =>
      new RegExp(
        `<li role="treeitem"[^>]*data-kind="([a-z]+)"[^>]*>(?:(?!</li>|<li).)*>${name}</span>`,
      ).exec(page)?.[1];
    expect(row('Refund single lines')).toBe('need');
    expect(row('A refund is issued within a second')).toBe('rule');
    expect(row('Design decisions')).toBe('group');
  });

  it('marks each entry with the path of its row in the tree', () => {
    expect(page).toContain('data-entry="need:refund-single-lines"');
    expect(page).toContain(
      'data-entry="need:refund-single-lines/rule:building_block|sales.refunds.Refund:Refund never exceeds paid amount"',
    );
  });

  it('marks the entry the address names as the reader’s place, and the row of it in the tree', async () => {
    const path =
      'decisions/rule:building_block|sales.orders.Order:Paid orders are final';
    const at = await render(path);
    expect(at).toMatch(
      new RegExp(
        `data-entry="${path.replaceAll('|', '\\|')}" aria-current="location"`,
      ),
    );
    expect(at).toMatch(
      new RegExp(
        `aria-selected="true"[^>]*data-path="${path.replaceAll('|', '\\|')}"`,
      ),
    );
  });

  it('lists the need no rule answers among the gaps', () => {
    const gaps = page.slice(page.indexOf('>Unaddressed needs</h2>'));
    expect(gaps).toMatch(/<h3[^>]*>Audit refunds<\/h3>/);
    expect(gaps).toContain('Finance');
  });
});
