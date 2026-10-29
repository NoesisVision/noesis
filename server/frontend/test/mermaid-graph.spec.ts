import { describe, expect, it } from 'bun:test';
import {
  graphKindOf,
  graphOf,
  linesOf,
  type MermaidDiagramData,
} from '../src/shared/ui/mermaid-canvas/mermaid-graph';

/* Fixtures in the shape mermaid 12's parser hands its layout (`db.getData()`). */

const FLOWCHART: MermaidDiagramData = {
  type: 'flowchart-v2',
  direction: 'LR',
  nodes: [
    { id: 'S', label: 'Payments', shape: 'rect', isGroup: true },
    { id: 'A', label: 'Checkout', shape: 'squareRect', isGroup: false },
    {
      id: 'B',
      label: 'Paid?',
      shape: 'diamond',
      parentId: 'S',
      isGroup: false,
    },
    { id: 'C', label: 'Ship', shape: 'stadium', parentId: 'S', isGroup: false },
    { id: 'D', label: 'Orders', shape: 'cylinder', isGroup: false },
    { id: 'E', label: 'a<br>b **bold**', shape: 'hexagon', isGroup: false },
  ],
  edges: [
    {
      start: 'A',
      end: 'B',
      label: 'pays',
      thickness: 'thick',
      pattern: 'thick',
      arrowTypeStart: 'none',
      arrowTypeEnd: 'arrow_point',
    },
    {
      start: 'B',
      end: 'D',
      label: 'no',
      thickness: 'dotted',
      pattern: 'dotted',
      arrowTypeStart: 'arrow_circle',
      arrowTypeEnd: 'arrow_cross',
    },
    { start: 'B', end: 'nowhere', arrowTypeEnd: 'arrow_point' },
  ],
};

describe('a mermaid diagram as a graph', () => {
  it('draws flowcharts, state, class and ER diagrams, and leaves the rest to mermaid', () => {
    expect(graphKindOf('flowchart-v2')).toBe('flowchart');
    expect(graphKindOf('stateDiagram')).toBe('state');
    expect(graphKindOf('classDiagram')).toBe('class');
    expect(graphKindOf('er')).toBe('er');
    expect(graphKindOf('sequence')).toBeNull();
    expect(graphOf({ type: 'gantt', nodes: [], edges: [] })).toBeNull();
  });

  it('reads a flowchart’s boxes, frames and lines', () => {
    const graph = graphOf(FLOWCHART)!;
    expect(graph.direction).toBe('RIGHT');
    expect(graph.frames).toEqual([
      { id: 'S', title: 'Payments', parent: null },
    ]);
    expect(
      graph.boxes.map(({ id, shape, parent }) => [id, shape, parent]),
    ).toEqual([
      ['A', 'box', null],
      ['B', 'diamond', 'S'],
      ['C', 'pill', 'S'],
      ['D', 'database', null],
      // A shape the canvas has no drawing of is a box.
      ['E', 'box', null],
    ]);
    const [pays, no, ...rest] = graph.lines;
    expect(pays).toMatchObject({
      source: 'A',
      target: 'B',
      label: 'pays',
      thick: true,
      pattern: 'solid',
      sourceEnd: 'none',
      targetEnd: 'arrow',
    });
    expect(no).toMatchObject({
      pattern: 'dotted',
      sourceEnd: 'circle',
      targetEnd: 'cross',
    });
    // A line to a box the diagram does not draw is left out.
    expect(rest).toEqual([]);
  });

  it('takes a label’s line breaks and leaves its marks off', () => {
    expect(linesOf('a<br>b **bold**')).toEqual(['a', 'b bold']);
    expect(linesOf('List&lt;Line&gt;')).toEqual(['List<Line>']);
    expect(linesOf(undefined)).toEqual([]);
  });

  it('reads a state diagram’s dots and bars, and drops the group a note sits in', () => {
    const graph = graphOf({
      type: 'stateDiagram',
      direction: 'TB',
      nodes: [
        {
          id: 'root_start',
          label: 'root_start',
          shape: 'stateStart',
          isGroup: false,
        },
        { id: 'A', label: 'A', shape: 'rect', isGroup: false },
        { id: 'f', label: 'f', shape: 'fork', isGroup: false },
        {
          id: 'A----parent',
          label: 'a note',
          shape: 'noteGroup',
          isGroup: true,
        },
        {
          id: 'A----note',
          label: 'a note',
          shape: 'note',
          parentId: 'A----parent',
          isGroup: false,
        },
        {
          id: 'root_end',
          label: 'root_end',
          shape: 'stateEnd',
          isGroup: false,
        },
      ],
      edges: [
        {
          start: 'root_start',
          end: 'A',
          label: '',
          arrowTypeEnd: 'arrow_barb',
        },
      ],
    })!;
    expect(graph.frames).toEqual([]);
    expect(
      graph.boxes.map(({ id, shape, lines, parent }) => [
        id,
        shape,
        lines,
        parent,
      ]),
    ).toEqual([
      ['root_start', 'start', [], null],
      ['A', 'box', ['A'], null],
      ['f', 'bar', [], null],
      ['A----note', 'note', ['a note'], null],
      ['root_end', 'end', [], null],
    ]);
    expect(graph.lines[0]).toMatchObject({ label: null, targetEnd: 'arrow' });
  });

  it('reads a class’s members and its relations’ UML ends and multiplicities', () => {
    const graph = graphOf({
      type: 'classDiagram',
      nodes: [
        {
          id: 'Order',
          label: 'Order',
          shape: 'classBox',
          isGroup: false,
          annotations: ['aggregate'],
          members: [
            { getDisplayDetails: () => ({ displayText: '+String id' }) },
          ],
          methods: [{ text: '\\+place(int qty) : bool' }],
        },
        { id: 'Line', label: 'Line', shape: 'classBox', isGroup: false },
        { id: 'Paid', label: 'Paid', shape: 'classBox', isGroup: false },
      ],
      edges: [
        {
          start: 'Order',
          end: 'Line',
          label: 'has',
          pattern: 'solid',
          arrowTypeStart: 'composition',
          arrowTypeEnd: 'none',
          startLabelRight: '1',
          endLabelLeft: 'many',
        },
        {
          start: 'Order',
          end: 'Paid',
          pattern: 'dashed',
          arrowTypeStart: 'extension',
          arrowTypeEnd: 'dependency',
        },
      ],
    })!;
    expect(graph.boxes[0]).toMatchObject({
      shape: 'class',
      annotations: ['aggregate'],
      members: ['+String id'],
      methods: ['+place(int qty) : bool'],
    });
    expect(graph.lines[0]).toMatchObject({
      sourceEnd: 'filledDiamond',
      sourceLabel: '1',
      targetLabel: 'many',
    });
    expect(graph.lines[1]).toMatchObject({
      pattern: 'dashed',
      sourceEnd: 'triangle',
      targetEnd: 'openArrow',
    });
  });

  it('reads an entity’s attributes and its cardinalities as crow’s feet', () => {
    const graph = graphOf({
      type: 'er',
      nodes: [
        {
          id: 'entity-ORDER-1',
          label: 'ORDER',
          shape: 'erBox',
          isGroup: false,
          attributes: [
            { type: 'string', name: 'id', keys: ['PK'], comment: '' },
          ],
        },
        { id: 'entity-LINE-2', label: 'LINE', shape: 'erBox', isGroup: false },
      ],
      edges: [
        {
          start: 'entity-ORDER-1',
          end: 'entity-LINE-2',
          label: 'contains',
          arrowTypeStart: 'only_one',
          arrowTypeEnd: 'zero_or_more',
        },
      ],
    })!;
    expect(graph.boxes[0]?.attributes).toEqual([
      { type: 'string', name: 'id', keys: ['PK'], comment: '' },
    ]);
    expect(graph.lines[0]).toMatchObject({
      sourceEnd: 'one',
      targetEnd: 'zeroOrMore',
    });
  });
});
