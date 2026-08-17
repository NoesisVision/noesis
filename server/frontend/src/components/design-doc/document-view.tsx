import * as React from 'react';
import {
  buildDocumentModel,
  type ContextGroup,
  type DocumentModel,
  type OutlineItem,
} from '@/components/design-doc/document-model';
import { UseCaseSection } from '@/components/design-doc/use-case-section';
import type { DesignDocumentDto } from '@/lib/design-docs';
import { cn } from '@/lib/utils';

/*
 * The read-only document view (plan phase 2): one specification read top to
 * bottom, a table-of-contents rail with scroll-spy beside it. Follows the
 * document-view prototype; the BlockNote editor replaces the sheet's innards
 * in phase 3, while the reading order and numbering stay this component's.
 */

function SectionHeading({
  item,
  level,
}: {
  item: { id: string; num: string; title: string };
  level: 1 | 2;
}) {
  const shared = 'scroll-mt-3 font-semibold';
  const num = (
    <span className="mr-2.5 font-normal text-muted-foreground tabular-nums">
      {item.num}
    </span>
  );
  if (level === 1) {
    return (
      <h2
        id={item.id}
        className={cn(
          shared,
          'mt-11 mb-2.5 border-t border-border pt-3.5 text-[21px]',
        )}
      >
        {num}
        {item.title}
      </h2>
    );
  }
  return (
    <h3 id={item.id} className={cn(shared, 'mt-8 mb-2 text-[17px]')}>
      {num}
      {item.title}
    </h3>
  );
}

function ScopeLabel({ children }: { children: string }) {
  return (
    <div className="mt-5 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  );
}

const NOT_WRITTEN = (
  <p className="text-[13px] text-muted-foreground">Not written yet.</p>
);

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5.5 marker:text-muted-foreground">
      {children}
    </ul>
  );
}

function FixedSections({ document }: { document: DesignDocumentDto }) {
  return (
    <>
      <SectionHeading
        item={{ id: 'sec-goal', num: '1', title: 'Goal' }}
        level={1}
      />
      {document.goal !== '' ? (
        <p className="text-[17px] leading-relaxed">{document.goal}</p>
      ) : (
        NOT_WRITTEN
      )}

      <SectionHeading
        item={{ id: 'sec-context', num: '2', title: 'Business context' }}
        level={1}
      />
      {document.businessContext.length > 0
        ? document.businessContext.map((paragraph) => (
            <p key={paragraph.id} className="my-1.5 whitespace-pre-wrap">
              {paragraph.text}
            </p>
          ))
        : NOT_WRITTEN}

      <SectionHeading
        item={{ id: 'sec-outcomes', num: '3', title: 'Target outcomes' }}
        level={1}
      />
      {document.outcomes.length > 0 ? (
        <Bullets>
          {document.outcomes.map((outcome) => (
            <li key={outcome.id}>
              {outcome.text}
              {outcome.measure !== '' && (
                <div className="text-[13px] text-muted-foreground">
                  measure: {outcome.measure}
                </div>
              )}
            </li>
          ))}
        </Bullets>
      ) : (
        NOT_WRITTEN
      )}

      <SectionHeading
        item={{ id: 'sec-scope', num: '4', title: 'Scope' }}
        level={1}
      />
      {document.scope.inScope.length === 0 &&
      document.scope.outOfScope.length === 0 ? (
        NOT_WRITTEN
      ) : (
        <>
          {document.scope.inScope.length > 0 && (
            <>
              <ScopeLabel>In scope</ScopeLabel>
              <Bullets>
                {document.scope.inScope.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </Bullets>
            </>
          )}
          {document.scope.outOfScope.length > 0 && (
            <>
              <ScopeLabel>Out of scope</ScopeLabel>
              <Bullets>
                {document.scope.outOfScope.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </Bullets>
            </>
          )}
        </>
      )}

      <SectionHeading
        item={{ id: 'sec-actors', num: '5', title: 'Actors' }}
        level={1}
      />
      {document.actors.length > 0 ? (
        <Bullets>
          {document.actors.map((actor) => (
            <li key={actor.id}>
              <strong className="font-semibold">{actor.name}</strong>
              <span className="text-[13px] text-muted-foreground">
                {' '}
                — {actor.kind === 'human' ? 'human role' : 'external system'}
              </span>
              {actor.description !== '' && <div>{actor.description}</div>}
            </li>
          ))}
        </Bullets>
      ) : (
        NOT_WRITTEN
      )}
    </>
  );
}

function ContextSection({
  group,
  model,
}: {
  group: ContextGroup;
  model: DocumentModel;
}) {
  return (
    <section>
      <SectionHeading
        item={{
          id: `sec-${group.context.id}`,
          num: group.num,
          title: `${group.context.name} context`,
        }}
        level={1}
      />
      <div className="mb-3.5 text-[13px] text-muted-foreground">
        {group.services.length} application service
        {group.services.length === 1 ? '' : 's'} · {group.useCaseCount} use case
        {group.useCaseCount === 1 ? '' : 's'}
      </div>
      {group.services.map((serviceGroup) => (
        <section key={serviceGroup.service.id}>
          <SectionHeading
            item={{
              id: `sec-${serviceGroup.service.id}`,
              num: serviceGroup.num,
              title: serviceGroup.service.name,
            }}
            level={2}
          />
          {serviceGroup.useCases.map((entry) => (
            <UseCaseSection
              key={entry.useCase.id}
              entry={entry}
              model={model}
            />
          ))}
        </section>
      ))}
    </section>
  );
}

/**
 * Scroll-spy over the outline: the first heading visible in the scroll
 * container is the active one, mirrored onto the matching TOC link.
 */
function useScrollSpy(
  outline: OutlineItem[],
  scrollRef: React.RefObject<HTMLElement | null>,
): string | null {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const root = scrollRef.current;
    if (root === null) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = outline.find((item) => visible.has(item.id));
        if (first !== undefined) setActiveId(first.id);
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    for (const item of outline) {
      const element = document.getElementById(item.id);
      if (element !== null) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [outline, scrollRef]);

  return activeId;
}

function TableOfContents({
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

export function DesignDocumentView({
  document: designDocument,
}: {
  document: DesignDocumentDto;
}) {
  const model = React.useMemo(
    () => buildDocumentModel(designDocument),
    [designDocument],
  );
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const activeId = useScrollSpy(model.outline, scrollRef);

  // Scroll the document pane itself rather than scrollIntoView: the jump
  // stays inside this container (never bubbling to an ancestor), and the
  // offset mirrors the headings' scroll-mt-3.
  const navigate = (id: string) => {
    const scroller = scrollRef.current;
    const element = document.getElementById(id);
    if (scroller === null || element === null) return;
    const top =
      element.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      12;
    scroller.scrollTo({ top });
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden text-[15px] leading-[1.65]">
      <TableOfContents
        outline={model.outline}
        activeId={activeId}
        onNavigate={navigate}
      />
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 pt-10 pb-40">
        <div className="mx-auto max-w-[780px]">
          <h1 className="mb-1 text-3xl font-semibold leading-tight">
            {designDocument.name}
          </h1>
          <div className="mb-8 text-[13px] text-muted-foreground">
            {designDocument.status} · {designDocument.date}
          </div>
          <FixedSections document={designDocument} />
          {model.contexts.map((group) => (
            <ContextSection
              key={group.context.id}
              group={group}
              model={model}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
