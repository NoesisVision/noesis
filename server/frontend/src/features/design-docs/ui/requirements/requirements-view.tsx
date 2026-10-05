import { useCallback, useMemo, useRef } from 'react';
import { expandablePaths } from '#/features/design-docs/ui/model-tree/outline-expansion.ts';
import { expansionMemory } from '#/features/design-docs/ui/model-tree/outline-memory.ts';
import { NO_KINDS } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { useFollowingTree } from '#/features/design-docs/ui/model-tree/use-following-tree.ts';
import {
  NO_REQUIREMENTS,
  requirementsOf,
  requirementsTreeOf,
} from '../../design-doc-requirements.ts';
import type { DesignDocDetail } from '../../design-docs.api.ts';
import { Columns } from '../columns.tsx';
import { OutlineSearchBox } from '../outline-search-box.tsx';
import { Outline } from '../outline.tsx';
import type { ViewPlace } from '../view-place.ts';
import { RequirementsDocument } from './requirements-document.tsx';

/*
 * The design read as a requirements document: each need with the rules that
 * answer it, then the rules no need asks for and the needs nothing answers.
 * A rule reads first as a review checks it — what it says and what verifies
 * it; where it lives and why sits in its details, a click away.
 *
 * It stands in the same frame as the model: the needs and their rules as a
 * tree on the left, the document on the right, and the row in hand brings its
 * entry into view. Where the reader is lives in the address under names of
 * its own, so the model keeps its place while the requirements are read.
 *
 * The page heading is the document's; a need or a section is an `h2`, a rule
 * or an unanswered need an `h3`, and a rule's scenarios an `h4`.
 *
 * Mount it under the document's id, as the model's workbench is.
 */
export function RequirementsView({
  changeId,
  detail,
  selected: addressed,
  query,
  onSelect,
  onQuery,
}: {
  changeId: string;
  detail: DesignDocDetail;
} & ViewPlace) {
  const doc = detail.document;
  const requirements = useMemo(
    () => requirementsOf(doc, detail.outline),
    [doc, detail.outline],
  );
  const nodes = useMemo(
    () => requirementsTreeOf(requirements, doc),
    [requirements, doc],
  );
  const memory = useMemo(
    () => expansionMemory(`noesis.designDocs.${doc.id}.requirements.expanded`),
    [doc.id],
  );
  const page = useRef<HTMLDivElement>(null);
  const revealInPage = useCallback(
    (path: string) => revealEntry(page.current, path),
    [],
  );
  /*
   * The document follows the reading position as the tree does, however it
   * moved: a row picked, a link into the middle of the requirements, Back or
   * Forward.
   *
   * Opened on an address that names no row, the reader is at the top of the
   * document; the row the tree opens at says where they are and moves nothing.
   */
  const { controller, outlineRef } = useFollowingTree(
    nodes,
    {
      selected: addressed,
      onSelect,
      query,
      onQuery,
      memory,
      // Rules are the rows here, so the tree leaves nothing out, and every
      // need and group opens on the rules under it: they are what it is for.
      excludeKinds: NO_KINDS,
      opensOn: expandablePaths,
    },
    { onArrive: revealInPage, followsOpening: false },
  );
  const at = controller.selected;

  return (
    <Columns
      search={<OutlineSearchBox controller={controller} counts="rows" />}
      outline={
        <Outline
          controller={controller}
          label="Requirements outline"
          empty={NO_REQUIREMENTS}
        />
      }
      outlineRef={outlineRef}
      detail={
        <RequirementsDocument
          ref={page}
          changeId={changeId}
          document={doc}
          requirements={requirements}
          selected={at}
        />
      }
    />
  );
}

/**
 * Brings the entry a row names to the top of the document. A tick later, as
 * the tree's own reveal does, so the move lands after the render it caused;
 * how it scrolls is the pane's stylesheet's to say.
 */
function revealEntry(within: HTMLElement | null, path: string): void {
  setTimeout(() => {
    for (const entry of within?.querySelectorAll<HTMLElement>('[data-entry]') ??
      []) {
      if (entry.dataset.entry !== path) continue;
      entry.scrollIntoView({ block: 'start' });
      return;
    }
  }, 0);
}
