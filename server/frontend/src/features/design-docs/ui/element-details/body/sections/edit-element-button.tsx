import { EditButton } from '../../../unit-editor/unit-actions.tsx';
import { type ElementRef, partOwnerOf } from '../../element-ref.ts';

/**
 * Edits the element a single-field section belongs to; nothing on a part's
 * own section, which no panel of the model opens.
 */
export function EditElementButton({
  element,
  field,
}: {
  element: ElementRef;
  field: string;
}) {
  const owner = partOwnerOf(element);
  return owner === null ? null : (
    <EditButton unit={{ kind: owner.kind, id: owner.id }} field={field} />
  );
}
