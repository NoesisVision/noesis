import { Text } from '#/shared/design-system/text.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import type { UnitRef } from '../../design-doc-edit.ts';
import {
  type DesignDocFieldInput,
  isUnchanged,
  valueOf,
} from '../../design-doc-field.ts';
import { InlineMarkdown } from '../unit-editor/inline-markdown.tsx';
import { useWritableUnit } from '../unit-editor/writable-unit.ts';
import classes from './element-detail.module.css';

/**
 * What an element is, under its name: the definition the design writes,
 * read as markdown. Where the document may be written it is written in place,
 * in the markdown editor with Save and Cancel. Where it is only read, a
 * definition the design leaves alone, or leaves blank, shows nothing.
 */
export function ElementDefinition({
  element,
  field,
}: {
  element: UnitRef | null;
  field: DesignDocFieldInput<string> | undefined;
}) {
  const writable = useWritableUnit(element);
  const value = field === undefined ? null : valueOf(field);
  const unchanged = field === undefined || isUnchanged(field) || value === null;
  const blank = unchanged || value.trim() === '';
  if (writable === null)
    return blank ? null : (
      <div className={classes.definition}>
        <Reading markdown={value} />
      </div>
    );
  return (
    <div className={classes.definition}>
      <InlineMarkdown
        label="Definition"
        value={value ?? ''}
        onSave={(definition) => writable.save({ definition })}
      >
        {blank ? (
          <Text span size="sm" c="dimmed" fs="italic">
            {unchanged ? 'Unchanged' : 'No definition yet'}
          </Text>
        ) : (
          <Reading markdown={value} />
        )}
      </InlineMarkdown>
    </div>
  );
}

/** The editor reads its markdown once, on mount: the page keys it by the element. */
const Reading = ({ markdown }: { markdown: string }) => (
  <MarkdownEditor markdown={markdown} headingLevel={3} readOnly noMargin />
);
