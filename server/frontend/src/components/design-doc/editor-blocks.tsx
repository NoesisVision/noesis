import type { DesignDocBlockType } from '@repo/design-doc-blocks';
import type * as React from 'react';
import { actor } from '@/components/design-doc/block/actor';
import { contextHeading } from '@/components/design-doc/block/contextHeading';
import { contextParagraph } from '@/components/design-doc/block/contextParagraph';
import { fieldRow } from '@/components/design-doc/block/fieldRow';
import { goal } from '@/components/design-doc/block/goal';
import { outcome } from '@/components/design-doc/block/outcome';
import { outputSummary } from '@/components/design-doc/block/outputSummary';
import { qualityAttribute } from '@/components/design-doc/block/qualityAttribute';
import { rule } from '@/components/design-doc/block/rule';
import { scenario } from '@/components/design-doc/block/scenario';
import { scopeItem } from '@/components/design-doc/block/scopeItem';
import { serviceHeading } from '@/components/design-doc/block/serviceHeading';
import type { RenderProps } from '@/components/design-doc/block/shared';
import { useCaseDescription } from '@/components/design-doc/block/useCaseDescription';
import { useCaseHeading } from '@/components/design-doc/block/useCaseHeading';
import { useCaseSummary } from '@/components/design-doc/block/useCaseSummary';

/*
 * The typed BlockNote schema (plan §4): each block type maps to one
 * design-doc element, sharing its config — prop schema, content kind — with
 * the server's headless schema through @repo/design-doc-blocks. What may
 * exist in the document comes from these specs; what may be *inserted where*
 * comes from the slash menu in design-doc-editor.tsx.
 */

/** The visual per type, mirroring the reading view's typography. */
export const RENDERERS: Record<
  DesignDocBlockType,
  (props: RenderProps) => React.ReactNode
> = {
  goal,
  contextParagraph,
  outcome,
  scopeItem,
  actor,
  contextHeading,
  serviceHeading,
  useCaseHeading,
  useCaseSummary,
  useCaseDescription,
  rule,
  fieldRow,
  outputSummary,
  scenario,
  qualityAttribute,
};
