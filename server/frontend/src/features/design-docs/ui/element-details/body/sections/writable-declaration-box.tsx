import { clsx } from 'clsx';
import { type PartOwner, unitOf } from '../../../../design-doc-edit.ts';
import { InlineText } from '../../../unit-editor/inline-text.tsx';
import { useWritableUnit } from '../../../unit-editor/writable-unit.ts';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useDesignDocument } from '../../design-document-context.ts';
import {
  nameFieldsOf,
  writtenByHuman,
  humanText,
  WrittenBy,
} from '../../human-mark.tsx';
import { DeclarationBox, DeclarationType } from './declaration-box.tsx';
import classes from './declaration-box.module.css';

/**
 * A declaration — a property, an input, an output — with what may be written
 * of it written in place: its name while the design adds it, as the model
 * knows one it has by its name. An output has no name of its own. Where the
 * design may not be written, the box only reads.
 */
export function WritableDeclarationBox({
  item,
  kind,
  owner,
  typePath,
  component: Component = 'div',
  output,
}: {
  item: ChangeListItem;
  kind: 'property' | 'parameter' | 'result';
  /** The element it is declared in; none where it is only read. */
  owner: PartOwner | null;
  typePath: string | null | undefined;
  component?: 'div' | 'li';
  output?: boolean;
}) {
  const ref =
    owner === null || item.key === undefined
      ? null
      : { kind, id: item.key, owner };
  const writable = useWritableUnit(ref);
  // Who wrote it, whether or not it may be written here.
  const doc = useDesignDocument();
  const designed = doc === null || ref === null ? null : unitOf(doc, ref);
  // The name is the declaration's key, with no writer of its own: marked
  // only where a human made the whole declaration.
  const whole = nameFieldsOf(designed);
  // An output has no name of its own to write.
  if (writable === null || item.key === undefined || kind === 'result')
    return (
      <DeclarationBox
        item={item}
        typePath={typePath}
        component={Component}
        output={output}
        nameWrittenOf={whole}
      />
    );
  return (
    <Component className={classes.box} data-output={output || undefined}>
      <WritableDeclarationName
        item={item}
        kind={kind}
        owner={owner}
        className={classes.name}
      />
      {item.type !== undefined && (
        <DeclarationType
          type={item.type}
          cardinality={item.cardinality}
          path={typePath}
          tagged
        />
      )}
    </Component>
  );
}

/**
 * A declaration's name with what may be written of it written in place:
 * renamed while the design adds it, else read, marked where a human wrote
 * it. Read alone where the design may not be written. An output has none.
 */
export function WritableDeclarationName({
  item,
  kind,
  owner,
  className,
}: {
  item: ChangeListItem;
  kind: 'property' | 'parameter';
  owner: PartOwner | null;
  className?: string;
}) {
  const ref =
    owner === null || item.key === undefined
      ? null
      : { kind, id: item.key, owner };
  const writable = useWritableUnit(ref);
  const doc = useDesignDocument();
  const designed = doc === null || ref === null ? null : unitOf(doc, ref);
  // The name is the declaration's key, with no writer of its own: marked
  // only where a human made the whole declaration.
  const whole = nameFieldsOf(designed);
  const name = item.name ?? item.key ?? item.label;
  if (writable === null || item.key === undefined)
    return (
      <WrittenBy fields={whole}>
        <span className={className}>{name}</span>
      </WrittenBy>
    );
  return writable.state === 'added' ? (
    <InlineText
      label="Name"
      human={writtenByHuman(whole)}
      value={item.key}
      className={clsx(className, humanText(whole))}
      onSave={(next) => writable.save({ name: next })}
    />
  ) : (
    <WrittenBy fields={whole}>
      <span className={className}>{name}</span>
    </WrittenBy>
  );
}
