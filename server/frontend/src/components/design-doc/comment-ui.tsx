import { filterSuggestionItems } from '@blocknote/core';
import {
  type ComponentProps,
  ComponentsContext,
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteContext,
} from '@blocknote/react';
import {
  BlockNoteView,
  components,
  ShadCNComponentsContext,
  ShadCNDefaultComponents,
} from '@blocknote/shadcn';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { accountsQueryOptions } from '@/lib/accounts';
import { cn } from '@/lib/utils';

/*
 * The comment composer pieces (plan phase 4, slice 3): the mention-aware
 * comment editor — a copy of the shadcn comments Editor that adds the `@`
 * menu over the accounts roster. The schema itself (with the `mention`
 * inline content) lives in comment-schema.tsx. Comments address people only
 * — no agent mention (plan §6).
 */

type CommentEditorProps = ComponentProps['Comments']['Editor'];

const CommentFormattingToolbar = () => {
  const items = getFormattingToolbarItems([]).filter(
    (item) =>
      item.key !== 'nestBlockButton' && item.key !== 'unnestBlockButton',
  );
  return (
    <FormattingToolbar blockTypeSelectItems={[]}>{items}</FormattingToolbar>
  );
};

/**
 * The shadcn comments Editor with an `@` suggestion menu added — the library
 * component's children are fixed, so this copy is how the menu gets into the
 * composer's BlockNoteView.
 */
const MentionCommentEditor = React.forwardRef<
  HTMLDivElement,
  CommentEditorProps
>((props, ref) => {
  const { className, onFocus, onBlur, autoFocus, editor, editable } = props;
  const blockNoteContext = useBlockNoteContext();
  const queryClient = useQueryClient();

  const getMentionItems = React.useCallback(
    async (query: string) => {
      const accounts = await queryClient.fetchQuery(accountsQueryOptions());
      return filterSuggestionItems(
        accounts.map((account) => ({
          title: account.name || account.login,
          subtext: `@${account.login}`,
          onItemClick: () => {
            editor.insertInlineContent([
              {
                type: 'mention',
                props: { accountId: account.id, login: account.login },
              },
              ' ',
            ] as never);
          },
        })),
        query,
      );
    },
    [editor, queryClient],
  );

  return (
    <BlockNoteView
      autoFocus={autoFocus}
      className={cn(className, 'dd-comment-editor')}
      theme={blockNoteContext?.colorSchemePreference}
      editor={editor}
      sideMenu={false}
      slashMenu={false}
      tableHandles={false}
      filePanel={false}
      formattingToolbar={false}
      editable={editable}
      ref={ref}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <FormattingToolbarController
        formattingToolbar={CommentFormattingToolbar}
      />
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={getMentionItems}
      />
    </BlockNoteView>
  );
});

/** The shadcn components map with the mention-aware comment editor. */
const commentComponents = {
  ...components,
  Comments: { ...components.Comments, Editor: MentionCommentEditor },
};

/**
 * Scopes the mention-aware comment editor to a subtree: any comment UI
 * rendered inside (floating composer, floating thread, threads sidebar)
 * composes with mentions. The shadcn primitives context comes along because
 * the shadcn Comments components read it, and only a shadcn BlockNoteView
 * provides it — the threads rail renders outside of one.
 */
export function CommentComponents({ children }: { children: React.ReactNode }) {
  return (
    <ShadCNComponentsContext.Provider value={ShadCNDefaultComponents}>
      <ComponentsContext.Provider value={commentComponents}>
        {children}
      </ComponentsContext.Provider>
    </ShadCNComponentsContext.Provider>
  );
}
