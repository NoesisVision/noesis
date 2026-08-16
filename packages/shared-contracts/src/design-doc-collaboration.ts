import { z } from 'zod';
import { DesignDocumentSchema } from './design-doc.js';
import { ElementRefSchema } from './design-doc-ref.js';

/*
 * Collaboration objects for the design-document workspace.
 *
 * These reference a document by id and anchor into it by element ref; they
 * never travel inside the portable specification (specification §14.8), so
 * exporting
 * or scanning a design document does not drag conversation along with it.
 *
 * Three kinds, with distinct authorship rules (plan §6):
 *
 * - Comments are a human conversation. The agent is never mentioned in one.
 * - Suggestions are the human review path — people propose wording to each
 *   other and accept or reject it one by one. The agent never authors them.
 * - Proposals are the agent's path: a whole-document change nobody asked for,
 *   reviewed and accepted as a unit. What a user does ask for is applied to
 *   the document directly and never becomes a proposal.
 */

/**
 * Where a comment or suggestion points. `ref` names the element or slot (see
 * `design-doc-ref.ts`) and `quote` the text it was attached to.
 *
 * An element ref is an id and nothing else, so a thread keeps pointing at its
 * element when that element is renamed, reordered, or moved to another parent.
 *
 * The quote is evidence, not the anchor mechanism: in the editor the anchor is
 * a mark carried in the shared document, so it survives concurrent edits
 * instead of being re-matched by text search. The quote is what lets a thread
 * still say what it was about once the mark is gone.
 */
export const DesignDocAnchorSchema = z.object({
  ref: ElementRefSchema,
  quote: z.string(),
});
export type DesignDocAnchor = z.infer<typeof DesignDocAnchorSchema>;

export const DesignDocAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().default(''),
});
export type DesignDocAuthor = z.infer<typeof DesignDocAuthorSchema>;

export const DesignDocCommentReplySchema = z.object({
  id: z.string(),
  author: DesignDocAuthorSchema,
  body: z.string(),
  createdAt: z.string(),
  /** Person ids only — a comment thread never addresses the agent. */
  mentions: z.array(z.string()).default([]),
});
export type DesignDocCommentReply = z.infer<typeof DesignDocCommentReplySchema>;

export const DesignDocCommentSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  anchor: DesignDocAnchorSchema,
  author: DesignDocAuthorSchema,
  body: z.string(),
  createdAt: z.string(),
  resolved: z.boolean().default(false),
  replies: z.array(DesignDocCommentReplySchema).default([]),
  /** Person ids only — a comment thread never addresses the agent. */
  mentions: z.array(z.string()).default([]),
});
export type DesignDocComment = z.infer<typeof DesignDocCommentSchema>;

export const DesignDocSuggestionStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
]);
export type DesignDocSuggestionStatus = z.infer<
  typeof DesignDocSuggestionStatusSchema
>;

export const DesignDocSuggestionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  anchor: DesignDocAnchorSchema,
  replacement: z.string(),
  author: DesignDocAuthorSchema,
  note: z.string().default(''),
  createdAt: z.string(),
  status: DesignDocSuggestionStatusSchema.default('pending'),
});
export type DesignDocSuggestion = z.infer<typeof DesignDocSuggestionSchema>;

/* --------------------------------------------------------------- proposals */

/**
 * What set the agent working. Every trigger is an as-is model change or the
 * agent's own initiative — never a user request, because a user request is
 * applied directly (plan §6).
 */
export const DesignDocProposalTriggerSchema = z.enum([
  'source_scan',
  'baseline_refresh',
  're_analysis',
  'agent_initiated',
]);
export type DesignDocProposalTrigger = z.infer<
  typeof DesignDocProposalTriggerSchema
>;

export const DesignDocProposalStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
]);
export type DesignDocProposalStatus = z.infer<
  typeof DesignDocProposalStatusSchema
>;

export const DesignDocImpactEntrySchema = z.object({
  ref: ElementRefSchema,
  label: z.string(),
  note: z.string().default(''),
});
export type DesignDocImpactEntry = z.infer<typeof DesignDocImpactEntrySchema>;

/**
 * The four columns of the impact summary. `specificationOnly` holds changes
 * that alter the document without changing what the codebase must do — they
 * produce no delta marker, so review would otherwise never see them.
 */
export const DesignDocProposalImpactSchema = z.object({
  added: z.array(DesignDocImpactEntrySchema).default([]),
  changed: z.array(DesignDocImpactEntrySchema).default([]),
  removed: z.array(DesignDocImpactEntrySchema).default([]),
  specificationOnly: z.array(DesignDocImpactEntrySchema).default([]),
});
export type DesignDocProposalImpact = z.infer<
  typeof DesignDocProposalImpactSchema
>;

/**
 * A human decision the proposal argues against, stated in the open with the
 * agent's reasoning, so accepting the proposal is never an accident.
 */
export const DesignDocChallengedDecisionSchema = z.object({
  ref: ElementRefSchema,
  humanDecision: z.string(),
  agentPosition: z.string(),
  reasoning: z.string(),
});
export type DesignDocChallengedDecision = z.infer<
  typeof DesignDocChallengedDecisionSchema
>;

/**
 * A whole-document proposal (specification §6.3–6.4). Accepted or rejected as
 * a unit — there is no field-by-field acceptance — so it carries the complete
 * proposed document rather than a patch.
 *
 * Proposal state is a separate dimension from codebase-relative state
 * (specification §14.7): a pending proposal does not change what the accepted
 * document says about the codebase.
 */
export const DesignDocProposalSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  trigger: DesignDocProposalTriggerSchema,
  status: DesignDocProposalStatusSchema.default('pending'),
  createdAt: z.string(),
  rationale: z.string().default(''),
  /** The document as it would read if accepted. */
  document: DesignDocumentSchema,
  impact: DesignDocProposalImpactSchema.default({
    added: [],
    changed: [],
    removed: [],
    specificationOnly: [],
  }),
  challengedDecisions: z.array(DesignDocChallengedDecisionSchema).default([]),
});
export type DesignDocProposal = z.infer<typeof DesignDocProposalSchema>;
