import { useDebouncedValue } from '#/shared/design-system/hooks.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Textarea } from '#/shared/design-system/textarea.tsx';
import { MermaidDiagram } from '#/shared/ui/mermaid-diagram.tsx';
import { type UnitForm, valueProps } from './unit-form.ts';

/*
 * A description's diagram typed in Mermaid, its picture drawn beside it
 * as it is typed.
 */

/** The source as it is typed, and the picture it draws once the typing stops. */
export function DiagramInput({
  form,
  invalid,
}: {
  form: UnitForm;
  invalid: boolean;
}) {
  const source = form.values.fields.diagram!.value;
  const [drawn] = useDebouncedValue(source.trim(), 500);
  return (
    <Stack gap="xs">
      <Textarea
        aria-label="Diagram"
        description="Mermaid source, without the fence. Leave it empty for no diagram."
        placeholder={'flowchart TD\n  A --> B'}
        autosize
        minRows={3}
        error={invalid}
        styles={{
          input: { fontFamily: 'var(--mantine-font-family-monospace)' },
        }}
        {...valueProps(form, 'fields.diagram.value')}
      />
      {drawn !== '' && <MermaidDiagram chart={drawn} />}
    </Stack>
  );
}
