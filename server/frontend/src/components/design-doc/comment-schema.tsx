import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';

// The comment editor schema, kept out of comment-ui.tsx so that module
// exports only components (Fast Refresh), mirroring editor-schema.ts.

/** A person mention inside a comment body, stored as `{ accountId, login }`. */
const mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      accountId: { default: '' },
      login: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <span className="rounded bg-secondary px-1 font-medium text-secondary-foreground">
        @{props.inlineContent.props.login}
      </span>
    ),
  },
);

/**
 * The default comment editor schema (paragraph, text, link, the five basic
 * styles) plus the mention. Passed to `CommentsExtension` so every comment
 * surface — composer, replies, edit-in-place — accepts mentions.
 */
export const commentEditorSchema = BlockNoteSchema.create({
  blockSpecs: { paragraph: defaultBlockSpecs.paragraph },
  inlineContentSpecs: {
    text: defaultInlineContentSpecs.text,
    link: defaultInlineContentSpecs.link,
    mention,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
  },
});
