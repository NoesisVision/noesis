import { useBlockNoteEditor } from '@blocknote/react';
import {
  type RenderProps,
  withGroup,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';
import { cn } from '@/lib/utils';

/** A prop-backed input that grows with its value, styled as plain text. */
function PropInput({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      className={cn(
        'rounded border bg-transparent px-1 py-0 hover:border-border focus:border-primary focus:outline-none',
        className,
      )}
      size={Math.max(value.length, placeholder.length, 4)}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * One typed field row: the business label is the inline content; the
 * structural half — `name: Type` — and the note are props, edited through
 * inputs so both wordings stay writable (plan §3.4).
 */
export function FieldRowBlock({ block, contentRef }: RenderProps) {
  const editor = useBlockNoteEditor();
  const set = (patch: Record<string, string>) => {
    editor.updateBlock(block as never, { props: patch } as never);
  };
  return (
    <div className="dd-editable flex items-baseline gap-3 border-b border-border py-1 text-sm">
      <span className="min-w-44 font-medium" ref={contentRef} />
      <span
        contentEditable={false}
        className="flex items-baseline font-mono text-xs text-muted-foreground"
      >
        <PropInput
          value={String(block.props.name ?? '')}
          placeholder="name"
          onChange={(value) => set({ name: value })}
        />
        :
        <PropInput
          value={String(block.props.fieldType ?? '')}
          placeholder="Type"
          onChange={(value) => set({ fieldType: value })}
        />
      </span>
      <span
        contentEditable={false}
        className="text-[13px] text-muted-foreground"
      >
        <PropInput
          value={String(block.props.note ?? '')}
          placeholder="note"
          onChange={(value) => set({ note: value })}
        />
      </span>
    </div>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the FieldRowBlock component; fieldRow is the renderer entry consumed by editor-blocks.tsx.
export const fieldRow = withUseCaseTail(
  withGroup((props) => <FieldRowBlock {...props} />),
);
