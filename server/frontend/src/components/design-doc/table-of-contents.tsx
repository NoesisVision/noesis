import * as React from 'react';
import type { OutlineItem } from '@/components/design-doc/editor-outline';
import { cn } from '@/lib/utils';

/*
 * The table-of-contents rail with scroll-spy, shared chrome of the document
 * view: entries come from the caller's outline model, targets are resolved
 * by element id — a heading's own id in a static render, a block's `data-id`
 * in the editor.
 */

export function TableOfContents({
  outline,
  activeId,
  onNavigate,
}: {
  outline: OutlineItem[];
  activeId: string | null;
  onNavigate: (id: string) => void;
}) {
  const activeRef = React.useRef<HTMLAnchorElement | null>(null);

  // Keep the active link in view while the reader scrolls the document.
  React.useEffect(() => {
    if (activeId !== null) {
      activeRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeId]);

  return (
    <nav
      aria-label="Table of contents"
      className="hidden w-64 shrink-0 overflow-auto border-r border-border bg-sidebar px-3 pt-4 pb-14 lg:block"
    >
      <h2 className="mb-2.5 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Contents
      </h2>
      {outline.map((item) => (
        <a
          key={item.id}
          ref={item.id === activeId ? activeRef : undefined}
          href={`#${item.id}`}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(item.id);
          }}
          className={cn(
            'flex items-baseline gap-2 rounded-md px-2 py-0.5 text-[13px] leading-normal text-secondary-foreground no-underline hover:bg-accent',
            item.level === 1 && 'mt-2.5 text-[13.5px] font-medium',
            item.level === 2 && 'pl-4',
            item.level === 3 && 'pl-7 text-muted-foreground',
            item.id === activeId &&
              'bg-card font-medium text-card-foreground shadow-[inset_0_0_0_1px_var(--border)]',
          )}
        >
          <span className="min-w-8 text-xs text-muted-foreground tabular-nums">
            {item.num}
          </span>
          <span>{item.title}</span>
        </a>
      ))}
    </nav>
  );
}
