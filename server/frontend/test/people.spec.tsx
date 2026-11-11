import { describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { architectureOf } from '../src/features/design-docs/design-doc-architecture';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import {
  invokersOf,
  performersOf,
  processPathOf,
  stepsOf,
} from '../src/features/design-docs/people';
import { ElementDetail } from '../src/features/design-docs/ui/element-details/element-detail';
import { outlineTree } from '../src/features/design-docs/ui/model-tree/outline-tree';
import { MantineProvider } from '../src/shared/design-system/provider';

void mock.module(
  '../src/features/design-docs/ui/element-details/markdown-reading.tsx',
  () => ({
    MarkdownReading: ({ markdown }: { markdown: string }) => (
      <span data-markdown>{markdown}</span>
    ),
  }),
);

const plain = <const T,>(value: T) => ({ value, author: 'agent' as const });

const AGENT = 'actor|Support agent';
const CLERK = 'actor|Clerk';
const REFUND = 'manual_process|Refund a returned order';
const CLOSE = 'manual_process|Close the day';
const ISSUE = 'behavior|sales.refunds.RefundService.issue';
const MARK = 'behavior|sales.orders.OrderService.markRefunded';
const COUNT = 'behavior|sales.refunds.RefundDesk.countTill';
const RECEIPT = 'rule|sales.refunds.Receipt checked by hand';

const document = {
  id: 'doc',
  name: 'Refunds',
  description: '',
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.RefundService',
        type: plain('application_service'),
      },
      {
        id: 'building_block|sales.orders.OrderService',
        type: plain('application_service'),
      },
      {
        id: 'building_block|sales.refunds.RefundDesk',
        type: plain('application_service'),
      },
    ],
  },
  behaviors: {
    added: [{ id: ISSUE }, { id: MARK }, { id: COUNT }],
  },
  rules: {
    added: [
      {
        id: RECEIPT,
        name: plain('Receipt checked by hand'),
        kind: plain('validation'),
        description: plain('The agent checks the receipt before refunding.'),
        needs: plain([]),
      },
    ],
  },
  actors: {
    added: [
      {
        id: AGENT,
        name: plain('Support agent'),
        definition: plain('Answers customers.'),
      },
    ],
    removed: [CLERK],
  },
  manualProcesses: {
    added: [
      {
        id: REFUND,
        name: plain('Refund a returned order'),
        definition: plain('Checks the returned lines and refunds them.'),
      },
      { id: CLOSE, name: plain('Close the day'), definition: plain('') },
    ],
  },
  relations: {
    added: [
      { kind: 'performs', from: AGENT, to: REFUND },
      {
        kind: 'process_invokes_behavior',
        from: REFUND,
        to: MARK,
        order: plain(2),
      },
      {
        kind: 'process_invokes_behavior',
        from: REFUND,
        to: ISSUE,
        order: plain(1),
      },
      {
        kind: 'process_invokes_behavior',
        from: CLOSE,
        to: COUNT,
        order: plain(1),
      },
      { kind: 'process_governs_rule', from: REFUND, to: RECEIPT },
    ],
    removed: [{ kind: 'performs', from: CLERK, to: REFUND }],
  },
} satisfies DesignDocumentInput;

describe('who drives the system', () => {
  it('reads the actors of a process, the processes calling a behavior and the steps in order', () => {
    expect(performersOf(document, REFUND)).toEqual([CLERK, AGENT]);
    expect(invokersOf(document, ISSUE)).toEqual([REFUND]);
    expect(stepsOf(document, REFUND).map(({ behavior }) => behavior)).toEqual([
      ISSUE,
      MARK,
    ]);
    expect(processPathOf(document, CLOSE)).toBe(CLOSE);
    expect(processPathOf(document, REFUND)).toBe(
      `${CLERK}#manual_process:${REFUND}`,
    );
  });
});

describe('the outline', () => {
  const outline = outlineOf(document);
  const roots = outline.filter((node) => node.parentPath === null);

  it('roots actors after the modules, and a process no actor performs after them', () => {
    expect(roots.map((node) => node.path)).toEqual([
      'module|sales',
      CLERK,
      AGENT,
      CLOSE,
    ]);
    expect(roots.find((node) => node.path === CLERK)?.change).toBe('removed');
  });

  it('shows a process under every actor that performs it, as itself', () => {
    const under = outline.filter((node) => node.elementId === REFUND);
    expect(under.map((node) => node.parentPath)).toEqual([CLERK, AGENT]);
    expect(under[0]).toMatchObject({
      kind: 'manual_process',
      name: 'Refund a returned order',
      change: 'added',
      depth: 1,
    });
  });

  it('hangs a rule a process keeps by hand under each row of the process', () => {
    expect(
      outline
        .filter((node) => node.kind === 'rule')
        .map((node) => node.parentPath),
    ).toEqual([
      `${CLERK}#manual_process:${REFUND}`,
      `${AGENT}#manual_process:${REFUND}`,
    ]);
  });
});

describe('the panels', () => {
  const tree = outlineTree(outlineOf(document), []);
  const show = (path: string) => {
    const node = tree.byPath.get(path)!;
    return renderToStaticMarkup(
      <MantineProvider>
        <ElementDetail
          node={node}
          path={tree
            .ancestryOf(path)
            .map((step) => tree.byPath.get(step))
            .filter((step) => step !== undefined)}
          document={document}
          onSelect={() => {}}
          tree={tree}
        />
      </MantineProvider>,
    );
  };

  it('says what an actor performs', () => {
    const html = show(AGENT);
    expect(html).toMatch(/<h2[^>]*>Support agent<\/h2>/);
    expect(html).toMatch(/Performs<\/span> <span[^>]*>1</);
    expect(html).toContain('Refund a returned order');
  });

  it('says who performs a process and lists its steps in order', () => {
    const html = show(`${AGENT}#manual_process:${REFUND}`);
    expect(html).toMatch(/Performed by<\/span> <span[^>]*>2</);
    expect(html).toContain('Steps');
    expect(html).toMatch(
      /1\. RefundService\.issue[\s\S]*2\. OrderService\.markRefunded/,
    );
    expect(html).toContain('Receipt checked by hand');
  });

  it('says which processes invoke a behavior, and nothing of who may call it', () => {
    const html = show(ISSUE);
    expect(html).toMatch(/Invoked by<\/span> <span[^>]*>1</);
    expect(html).not.toContain('Public');
    expect(html).not.toContain('Private');
  });
});

describe('the architecture', () => {
  const [refunds] = architectureOf(document).hexagons;
  const port = (id: string) =>
    refunds?.drivingPorts.find(({ behavior }) => behavior.id === id);

  it('reads a port’s actors through the processes that invoke it', () => {
    expect(port(ISSUE)).toMatchObject({
      actors: ['Support agent'],
      callerKnown: true,
    });
    // Close the day is performed by no one: the port knows its caller, but
    // no actor.
    expect(port(COUNT)).toMatchObject({ actors: [], callerKnown: true });
  });
});
