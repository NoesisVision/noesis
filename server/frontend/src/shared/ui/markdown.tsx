import {
  type ComponentPropsWithoutRef,
  isValidElement,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './mermaid-diagram.tsx';
import classes from './markdown.module.css';

const MERMAID_LANGUAGE = 'language-mermaid';

/**
 * Markdown as the graph stores it: GitHub flavour — tables, task lists,
 * strikethrough — with a mermaid fence drawn as the diagram it describes
 * rather than printed as its source.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className={classes.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: Pre }}>
        {children}
      </ReactMarkdown>
    </div>
  );
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
