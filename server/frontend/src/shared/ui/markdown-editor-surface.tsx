import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ButtonWithTooltip,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  headingsPlugin,
  insertCodeBlock$,
  InsertTable,
  InsertThematicBreak,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  type RealmPlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
  usePublisher,
} from '@mdxeditor/editor';
import { IconChartDots3 } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import {
  MERMAID_LANGUAGE,
  mermaidCodeBlock,
  NEW_DIAGRAM,
} from './mermaid-code-block.ts';
import { type HeadingDepth, nestedHeadingsPlugin } from './nested-headings.ts';
import classes from './markdown-editor.module.css';
import '@mdxeditor/editor/style.css';

export interface MarkdownEditorProps {
  /** Read once, when the editor mounts. */
  markdown: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
  /**
   * What the document's own `#` becomes on screen. The page around it is
   * already headed, so its first heading nests under that one rather than
   * opening a second outline beside it.
   */
  headingLevel?: HeadingDepth;
}

/** The fences the plain code editor offers, past the diagram of its own. */
const CODE_LANGUAGES = {
  '': 'Plain text',
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  json: 'JSON',
  css: 'CSS',
  sh: 'Shell',
  [MERMAID_LANGUAGE]: 'Mermaid',
};

export default function MarkdownEditorSurface({
  markdown,
  onChange,
  readOnly = false,
  headingLevel = 2,
}: MarkdownEditorProps) {
  const scheme = useComputedColorScheme('light');

  return (
    <MDXEditor
      markdown={markdown}
      onChange={onChange}
      readOnly={readOnly}
      // MDXEditor's own stylesheet switches on this name; it is not a Mantine
      // class, and the editor is the one part of the page Mantine does not
      // dress.
      className={scheme === 'dark' ? 'dark-theme' : undefined}
      contentEditableClassName={clsx(
        classes.content,
        readOnly && classes.reading,
      )}
      plugins={documentPlugins(headingLevel, readOnly)}
    />
  );
}

function documentPlugins(
  headingLevel: HeadingDepth,
  readOnly: boolean,
): RealmPlugin[] {
  return [
    headingsPlugin(),
    nestedHeadingsPlugin({ topLevel: headingLevel }),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    tablePlugin(),
    codeBlockPlugin({
      codeBlockEditorDescriptors: [mermaidCodeBlock],
      defaultCodeBlockLanguage: '',
    }),
    codeMirrorPlugin({ codeBlockLanguages: CODE_LANGUAGES }),
    markdownShortcutPlugin(),
    // A toolbar of controls that cannot be used is worse than none, and the
    // source view it toggles is for an author comparing a draft to what was
    // there before.
    ...(readOnly
      ? []
      : [
          diffSourcePlugin({ viewMode: 'rich-text' }),
          toolbarPlugin({ toolbarContents: Toolbar }),
        ]),
  ];
}

function Toolbar() {
  return (
    <DiffSourceToggleWrapper>
      <UndoRedo />
      <Separator />
      <BoldItalicUnderlineToggles />
      <Separator />
      <BlockTypeSelect />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertTable />
      <InsertThematicBreak />
      <InsertDiagram />
    </DiffSourceToggleWrapper>
  );
}

/**
 * The toolbar's own entry to a mermaid fence: the language select only reaches
 * a diagram once a code block is already there.
 */
function InsertDiagram() {
  const insertCodeBlock = usePublisher(insertCodeBlock$);

  return (
    <ButtonWithTooltip
      title="Insert diagram"
      aria-label="Insert diagram"
      onClick={() => {
        insertCodeBlock({ language: MERMAID_LANGUAGE, code: NEW_DIAGRAM });
      }}
    >
      <IconChartDots3 size={18} aria-hidden />
    </ButtonWithTooltip>
  );
}
