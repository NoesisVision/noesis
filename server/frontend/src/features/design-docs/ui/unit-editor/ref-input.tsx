import { Select } from '#/shared/design-system/select.tsx';
import {
  addressOf,
  isBuildingBlock,
  nameOf,
} from '#/shared/model/element-id.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { blocksNamedIn, PRIMITIVES } from '../../design-doc-edit.ts';

/*
 * A slot's type chosen from a list: the building blocks the design names,
 * then the primitives.
 */

/**
 * A type: a primitive or a building block the design names. How many of it
 * is a field of its own. Blocks only the scanned model knows are not offered.
 */
export function RefInput({
  value,
  onChange,
  blocksOnly,
  document: doc,
  ...common
}: {
  value: string;
  onChange: (ref: string) => void;
  blocksOnly: boolean;
  document: DesignDocumentInput;
  'aria-label': string;
  error: boolean;
  disabled: boolean;
}) {
  const blocks = blocksNamedIn(doc);
  const current = value !== '' ? [value] : [];
  const blockIds = [...new Set([...blocks, ...current])].filter(
    isBuildingBlock,
  );
  const data = [
    ...(blocksOnly
      ? []
      : [
          {
            group: 'Primitives',
            items: PRIMITIVES.map((id) => ({ value: id, label: nameOf(id) })),
          },
        ]),
    {
      group: 'Building blocks in this design',
      items: blockIds.map((id) => ({ value: id, label: addressOf(id) })),
    },
  ];
  return (
    <Select
      {...common}
      searchable
      placeholder="Choose a type"
      nothingFoundMessage="No such type in this design"
      allowDeselect={false}
      data={data}
      value={value !== '' ? value : null}
      onChange={(next) => onChange(next ?? '')}
    />
  );
}
