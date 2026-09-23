import {
  type ComponentPropsWithoutRef,
  isValidElement,
  type ReactNode,
} from 'react';
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './mermaid-diagram.tsx';
import classes from './markdown.module.css';

const MERMAID_LANGUAGE = 'language-mermaid';

const HEADING_DEPTHS = [1, 2, 3, 4, 5, 6] as const;
type HeadingDepth = (typeof HEADING_DEPTHS)[number];
type HeadingTag = `h${HeadingDepth}`;

/**
 * Markdown as the graph stores it: GitHub flavour — tables, task lists,
 * strikethrough — with a mermaid fence drawn as the diagram it describes
 * rather than printed as its source.
 */
export function Markdown({
  children,
  headingLevel = 2,
}: {
  children: string;
  /**
   * What the document's own `#` becomes. The page around it is already
   * headed, so its first heading has to nest under that one rather than
   * open a second outline beside it.
   */
  headingLevel?: HeadingDepth;
}) {
  return (
    <div className={classes.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ pre: Pre, ...headings(headingLevel) }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Every level moved down by the same step, and never past `h6`. */
function headings(topLevel: HeadingDepth): Components {
  const step = topLevel - 1;
  return Object.fromEntries(
    HEADING_DEPTHS.map((depth) => [
      `h${depth}`,
      heading(Math.min(depth + step, 6) as HeadingDepth),
    ]),
  );
}

function heading(depth: HeadingDepth) {
  const Tag: HeadingTag = `h${depth}`;
  return function Heading({
    node: _node,
    ...props
  }: ComponentPropsWithoutRef<'h1'> & ExtraProps) {
    return <Tag {...props} />;
  };
}

/**
 * A fence arrives as `<pre><code class="language-…">`, so the diagram has to
 * replace the `pre`: an SVG is not phrasing content and cannot live inside one.
 */
function Pre({
  children,
  node: _node,
  ...props
}: ComponentPropsWithoutRef<'pre'> & ExtraProps) {
  const chart = mermaidSource(children);
  if (chart !== null) return <MermaidDiagram chart={chart} />;
  return <pre {...props}>{children}</pre>;
}

function mermaidSource(children: ReactNode): string | null {
  if (!isValidElement<ComponentPropsWithoutRef<'code'>>(children)) return null;
  const { className, children: source } = children.props;
  if (!className?.split(' ').includes(MERMAID_LANGUAGE)) return null;
  return typeof source === 'string' ? source.trimEnd() : null;
}
