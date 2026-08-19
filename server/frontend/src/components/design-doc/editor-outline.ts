import * as React from 'react';
/*
 * The table-of-contents model over the editor's block list — the same
 * numbering the prototype fixes: five document sections, then bounded
 * contexts from 6, services x.y, use cases x.y.z. Anchors are block ids;
 * BlockNote renders every block with a `data-id` attribute to scroll to.
 */

export interface OutlineItem {
  /** The block id the entry scrolls to. */
  id: string;
  level: 1 | 2 | 3;
  num: string;
  title: string;
}

interface OutlineBlock {
  id: string;
  type: string;
  content?: unknown;
}

function blockText(block: OutlineBlock): string {
  if (!Array.isArray(block.content)) return '';
  return block.content
    .map((run) =>
      typeof run === 'object' && run !== null && 'text' in run
        ? String((run as { text: unknown }).text)
        : '',
    )
    .join('');
}

const FIXED_SECTIONS: { types: string[]; title: string }[] = [
  { types: ['goal'], title: 'Goal' },
  { types: ['contextParagraph'], title: 'Business context' },
  { types: ['outcome'], title: 'Target outcomes' },
  { types: ['scopeItem'], title: 'Scope' },
  { types: ['actor'], title: 'Actors' },
];

export function buildOutlineFromBlocks(blocks: OutlineBlock[]): OutlineItem[] {
  const outline: OutlineItem[] = [];

  // Fixed sections anchor at their first block; numbering stays 1–5 even
  // when a section holds nothing yet (it then simply has no entry).
  FIXED_SECTIONS.forEach((section, index) => {
    const first = blocks.find((block) => section.types.includes(block.type));
    if (first !== undefined) {
      outline.push({
        id: first.id,
        level: 1,
        num: String(index + 1),
        title: section.title,
      });
    }
  });

  let contextCount = FIXED_SECTIONS.length;
  let serviceIndex = 0;
  let useCaseIndex = 0;
  let contextNum = '';
  let serviceNum = '';
  for (const block of blocks) {
    if (block.type === 'contextHeading') {
      contextCount += 1;
      contextNum = String(contextCount);
      serviceIndex = 0;
      outline.push({
        id: block.id,
        level: 1,
        num: contextNum,
        title: `${blockText(block)} context`,
      });
    }
    if (block.type === 'serviceHeading' && contextNum !== '') {
      serviceIndex += 1;
      serviceNum = `${contextNum}.${serviceIndex}`;
      useCaseIndex = 0;
      outline.push({
        id: block.id,
        level: 2,
        num: serviceNum,
        title: blockText(block),
      });
    }
    if (block.type === 'useCaseHeading' && serviceNum !== '') {
      useCaseIndex += 1;
      outline.push({
        id: block.id,
        level: 3,
        num: `${serviceNum}.${useCaseIndex}`,
        title: blockText(block),
      });
    }
  }
  return outline;
}

export function resolveBlockElement(id: string): Element | null {
  return document.querySelector(`[data-id="${CSS.escape(id)}"]`);
}

/**
 * The first outline target visible in the scroll container is the active
 * entry, mirrored onto the matching TOC link.
 */
export function useScrollSpy(
  outline: OutlineItem[],
  scrollRef: React.RefObject<HTMLElement | null>,
  resolve: (id: string) => Element | null,
): string | null {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const byElement = React.useRef(new Map<Element, string>());

  React.useEffect(() => {
    const root = scrollRef.current;
    if (root === null) return;
    const visible = new Set<string>();
    byElement.current = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = byElement.current.get(entry.target);
          if (id === undefined) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = outline.find((item) => visible.has(item.id));
        if (first !== undefined) setActiveId(first.id);
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    for (const item of outline) {
      const element = resolve(item.id);
      if (element !== null) {
        byElement.current.set(element, item.id);
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, [outline, scrollRef, resolve]);

  return activeId;
}
