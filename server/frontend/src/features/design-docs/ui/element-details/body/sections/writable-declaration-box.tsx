import { clsx } from 'clsx';
import type {
  DesignedParameterInput,
  DesignedPropertyInput,
  DesignedResultInput,
} from '#backend/app/design-docs/design-doc.ts';
import { type PartOwner, unitOf } from '../../../../design-doc-edit.ts';
import { valueOf } from '../../../../design-doc-field.ts';
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
 * of it written in place: its description, and its name while the design
 * adds it, as the model knows one it has by its name. An output has no name.
 * Where the design may not be written, the box only reads.
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
  const designed = (doc === null || ref === null ? null : unitOf(doc, ref)) as
    | DesignedPropertyInput
    | DesignedParameterInput
    | DesignedResultInput
    | null;
  const written = [designed?.description];
  // The name is the declaration's key, with no writer of its own: marked
  // only where a human made the whole declaration.
  const whole = nameFieldsOf(designed);
  if (writable === null || item.key === undefined)
    return (
      <DeclarationBox
        item={item}
        typePath={typePath}
        component={Component}
        output={output}
        writtenOf={written}
        nameWrittenOf={whole}
      />
    );
  const unit = writable.unit as
    | DesignedPropertyInput
    | DesignedParameterInput
    | DesignedResultInput
    | null;
  const named = kind !== 'result';
  return (
    <Component className={classes.box} data-output={output || undefined}>
      {named &&
        (writable.state === 'added' ? (
          <InlineText
            label="Name"
            human={writtenByHuman(whole)}
            value={item.key}
            className={clsx(classes.name, humanText(whole))}
            onSave={(name) => writable.save({ name })}
          />
        ) : (
          <WrittenBy fields={whole}>
            <span className={classes.name}>{item.name ?? item.key}</span>
          </WrittenBy>
        ))}
      {item.type !== undefined && (
        <DeclarationType type={item.type} path={typePath} named={named} />
      )}
      <InlineText
        label="Description"
        human={writtenByHuman(written)}
        value={valueOf(unit?.description) ?? ''}
        multiline
        className={clsx(classes.description, humanText(written))}
        onSave={(description) => writable.save({ description })}
      />
    </Component>
  );
}
