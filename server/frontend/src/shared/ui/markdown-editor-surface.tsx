import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ButtonWithTooltip,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
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
  noMargin?: boolean;
  /** Offer the kind of block — a heading, a quote — in the toolbar; a field of plain paragraphs needs none. */
  blockTypes?: boolean;
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
  noMargin = false,
  blockTypes = true,
}: MarkdownEditorProps) {
  const scheme = useComputedColorScheme('light');
  return (
    <MDXEditor
      markdown={markdown}
      onChange={onChange}
      readOnly={readOnly}
      // `dark-theme` is MDXEditor's own switch, not a Mantine class: the
      // editor is the one part of the page Mantine does not dress. The class
      // also lands on the box its dialogs open in, at the end of the body,
      // where `popups` lifts them over a modal the editor is in.
      className={clsx(scheme === 'dark' && 'dark-theme', classes.popups)}
      contentEditableClassName={clsx(
        classes.content,
        readOnly ? classes.reading : classes.field,
        noMargin && classes.noMargin,
      )}
      plugins={documentPlugins(headingLevel, readOnly, blockTypes)}
    />
  );
}

function documentPlugins(
  headingLevel: HeadingDepth,
  readOnly: boolean,
  blockTypes: boolean,
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
    // A toolbar of controls that cannot be used is worse than none. The text
    // is only ever written as it reads: no source or diff view to switch to.
    ...(readOnly
      ? []
      : [
          toolbarPlugin({
            toolbarContents: () => <Toolbar blockTypes={blockTypes} />,
            toolbarClassName: classes.toolbar,
          }),
        ]),
  ];
}

/**
 * How the text reads — history, emphasis, the kind of block — then what goes
 * into it.
 */
function Toolbar({ blockTypes }: { blockTypes: boolean }) {
  return (
    <>
      <UndoRedo />
      <Separator />
      <BoldItalicUnderlineToggles />
      {blockTypes && (
        <>
          <Separator />
          <BlockTypeSelect />
        </>
      )}
      <Separator />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertTable />
      <InsertThematicBreak />
      <InsertDiagram />
    </>
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
