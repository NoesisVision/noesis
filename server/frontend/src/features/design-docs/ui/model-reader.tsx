import { useMemo } from 'react';
import { outlineOf } from '../design-doc-outline.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DesignDocWorkbench } from './design-doc-workbench.tsx';
import type { ViewPlace } from './view-place.ts';

/**
 * A model read as a design's model is — the tree on the left, the element in
 * hand on the right — but as it stands rather than as a change: every row is
 * unchanged, and with no `UnitEditor` around it nothing may be moved or
 * written.
 *
 * Mount it under the model's id, as the workbench is.
 */
export function ModelReader({
  document,
  ...place
}: { document: DesignDocDetail['document'] } & ViewPlace) {
  const detail = useMemo(
    () =>
      ({
        document,
        outline: outlineOf(document).map((node) => ({
          ...node,
          change: 'unchanged' as const,
        })),
      }) satisfies DesignDocDetail,
    [document],
  );
  return <DesignDocWorkbench detail={detail} {...place} />;
}
