import { z } from 'zod';

/**
 * The words a Mermaid diagram opens with, each the root of its kind:
 * `stateDiagram` covers `stateDiagram-v2`, `C4` every C4 view, `xychart` the
 * `-beta` it once had. Mermaid's own detectors are the source of truth; a kind
 * it adds later is added here.
 */
const DIAGRAM_KINDS = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'requirement',
  'gitGraph',
  'C4',
  'mindmap',
  'timeline',
  'sankey',
  'xychart',
  'block',
  'packet',
  'kanban',
  'architecture',
  'radar',
  'treemap',
  'treeView',
  'venn',
  'wardley',
  'ishikawa',
  'cynefin',
  'railroad',
  'swimlane',
  'usecase',
  'eventmodeling',
  'agentflow',
];

/** An optional front matter, blank or `%%` lines, then the kind's word. */
const MERMAID_SOURCE = new RegExp(
  String.raw`^(?:---\n[\s\S]*?\n---[ \t]*\n)?(?:[ \t]*(?:%%[^\n]*)?\n)*[ \t]*(?:${DIAGRAM_KINDS.join('|')})[\w-]*(?:\s[\s\S]*)?$`,
);

export const MermaidSource = z
  .string()
  .regex(MERMAID_SOURCE, 'Not a Mermaid diagram')
  .describe(
    "The source of one Mermaid diagram, as it goes inside a ```mermaid fence but without the fence: it opens with the diagram's kind, e.g. 'sequenceDiagram' or 'flowchart TD', optionally after front matter or %% lines.",
  );
export type MermaidSource = z.infer<typeof MermaidSource>;
