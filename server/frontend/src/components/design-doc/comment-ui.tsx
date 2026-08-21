import { type BlockNoteEditor, filterSuggestionItems } from '@blocknote/core';
import { CommentsExtension } from '@blocknote/core/comments';
import {
  type ComponentProps,
  ComponentsContext,
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteContext,
  useCreateBlockNote,
  useDictionary,
  useEditorState,
  useFocusWithin,
} from '@blocknote/react';
import {
  BlockNoteView,
  components,
  ShadCNComponentsContext,
  ShadCNDefaultComponents,
} from '@blocknote/shadcn';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { commentEditorSchema } from '@/components/design-doc/comment-schema';
import { Button } from '@/components/ui/button';
import { accountsQueryOptions } from '@/lib/accounts';
import { cn } from '@/lib/utils';

/*
 * The comment composer pieces (plan phase 4, slice 3): the mention-aware
 * comment editor — a copy of the shadcn comments Editor that adds the `@`
 * menu over the accounts roster. The schema itself (with the `mention`
 * inline content) lives in comment-schema.tsx, and the thread-anchor patch
 * hook lives in comment-thread-anchor.ts — both kept out of this file so it
 * exports only components (Fast Refresh). Comments address people only —
 * no agent mention (plan §6).
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

/**
 * The new-comment composer, rendered as a card inside the threads rail at
 * the pending comment's document position (comments live only in the rail —
 * nothing floats over the text). It appears while a comment is pending (the
 * toolbar's add-comment button started one over the current selection) and
 * writes through the same patched `createThread`, so the anchor metadata is
 * stamped as usual.
 */
export function RailComposer({
  editor,
  pending,
}: {
  editor: BlockNoteEditor<never, never, never>;
  pending: boolean;
}) {
  // A fresh, empty composer per pending comment.
  const composer = useCreateBlockNote(
    {
      schema: commentEditorSchema,
      trailingBlock: false,
      dictionary: {
        ...editor.dictionary,
        placeholders: {
          ...editor.dictionary.placeholders,
          emptyDocument: editor.dictionary.placeholders.new_comment,
        },
      } as never,
    },
    [pending],
  );
  const isEmpty = useEditorState({
    editor: composer,
    selector: ({ editor: composerEditor }) => composerEditor.isEmpty,
  });

  const comments = editor.getExtension(CommentsExtension);
  if (!pending || comments === undefined) return null;

  const save = async () => {
    if (composer.isEmpty) return;
    await comments.createThread({
      initialComment: { body: composer.document },
    });
    comments.stopPendingComment();
    editor.focus();
  };
  const cancel = () => {
    comments.stopPendingComment();
    editor.focus();
  };

  return (
    <div
      data-rail-composer=""
      className="rounded-lg border border-primary/50 bg-card p-2 ring-1 ring-primary/40"
    >
      <MentionCommentEditor
        autoFocus={true}
        editable={true}
        editor={composer as never}
        className="rounded border border-border"
        onFocus={() => undefined}
        onBlur={() => undefined}
      />
      <div className="mt-1.5 flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="h-7" onClick={cancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7" disabled={isEmpty} onClick={save}>
          Comment
        </Button>
      </div>
    </div>
  );
}

/*
 * The thread-card look (the rail's Google-Docs pass): the shadcn Comments
 * Card selects with a background swap and sizes its author row larger than
 * the rail's suggestion cards. These overrides restyle the card to the
 * suggestion card's look — border + ring when selected, 24px avatar, 13px
 * name over an 11px muted line — leaving all behaviour to the library.
 */

function ThreadAuthorAvatar({
  authorInfo,
}: {
  authorInfo: { username: string; avatarUrl?: string };
}) {
  if (authorInfo.avatarUrl !== undefined && authorInfo.avatarUrl !== '') {
    return (
      <img
        src={authorInfo.avatarUrl}
        alt=""
        className="size-6 shrink-0 rounded-full"
      />
    );
  }
  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
      {authorInfo.username.slice(0, 1).toUpperCase()}
    </div>
  );
}

const ThreadCard = React.forwardRef<
  HTMLDivElement,
  ComponentProps['Comments']['Card']
>((props, ref) => {
  const {
    className,
    children,
    selected,
    headerText,
    onFocus,
    onBlur,
    tabIndex,
  } = props;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focus/blur drive the library's thread selection; the card itself is not a control.
    <div
      ref={ref}
      className={cn(
        className,
        'rounded-lg border border-border bg-card text-sm',
        selected && 'border-primary/50 ring-1 ring-primary/40',
      )}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
    >
      {headerText !== undefined && (
        <div className="px-3 pt-3 text-xs text-muted-foreground italic">
          {headerText}
        </div>
      )}
      {children}
    </div>
  );
});

const ThreadCardSection = React.forwardRef<
  HTMLDivElement,
  ComponentProps['Comments']['CardSection']
>((props, ref) => {
  const { className, children } = props;
  return (
    <div
      ref={ref}
      className={cn(
        className,
        'p-3',
        className?.includes('thread-comments')
          ? 'flex flex-col gap-4 border-b border-border last:border-b-0'
          : '',
      )}
    >
      {children}
    </div>
  );
});

const ThreadComment = React.forwardRef<
  HTMLDivElement,
  ComponentProps['Comments']['Comment']
>((props, ref) => {
  const {
    className,
    showActions,
    authorInfo,
    timeString,
    actions,
    edited,
    emojiPickerOpen,
    children,
  } = props;
  const dict = useDictionary();
  const [hovered, setHovered] = React.useState(false);
  const { focused, ref: focusRef } = useFocusWithin();

  const doShowActions =
    actions &&
    (showActions === true ||
      showActions === undefined ||
      (showActions === 'hover' && hovered) ||
      focused ||
      emojiPickerOpen);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only reveals the action toolbar, mirroring the library component this replaces.
    <div
      ref={ref}
      className={cn(className, 'relative flex flex-col gap-2')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {doShowActions ? (
        <div className="absolute top-0 right-0 z-10" ref={focusRef}>
          {actions}
        </div>
      ) : null}
      {authorInfo === 'loading' ? (
        <div className="flex items-center gap-2">
          <div className="size-6 animate-pulse rounded-full bg-secondary" />
          <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <ThreadAuthorAvatar authorInfo={authorInfo} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">
              {authorInfo.username}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {timeString}
              {edited && ` (${dict.comments.edited})`}
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
});

/** The shadcn components map with the mention-aware editor and restyled cards. */
const commentComponents = {
  ...components,
  Comments: {
    ...components.Comments,
    Editor: MentionCommentEditor,
    Card: ThreadCard,
    CardSection: ThreadCardSection,
    Comment: ThreadComment,
  },
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
