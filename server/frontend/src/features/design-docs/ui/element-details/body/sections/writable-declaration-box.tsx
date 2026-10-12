import type {
  DesignedParameterInput,
  DesignedPropertyInput,
  DesignedResultInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { PartOwner } from '../../../../design-doc-edit.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import { InlineText } from '../../../unit-editor/inline-text.tsx';
import { useWritableUnit } from '../../../unit-editor/writable-unit.ts';
import type { ChangeListItem } from '../../change-list-items.ts';
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
  const writable = useWritableUnit(
    owner === null || item.key === undefined
      ? null
      : { kind, id: item.key, owner },
  );
  if (writable === null || item.key === undefined)
    return (
      <DeclarationBox
        item={item}
        typePath={typePath}
        component={Component}
        output={output}
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
            value={item.key}
            className={classes.name}
            onSave={(name) => writable.save({ name })}
          />
        ) : (
          <span className={classes.name}>{item.name ?? item.key}</span>
        ))}
      {item.type !== undefined && (
        <DeclarationType type={item.type} path={typePath} named={named} />
      )}
      <InlineText
        label="Description"
        value={valueOf(unit?.description) ?? ''}
        multiline
        className={classes.description}
        onSave={(description) => writable.save({ description })}
      />
    </Component>
  );
}
