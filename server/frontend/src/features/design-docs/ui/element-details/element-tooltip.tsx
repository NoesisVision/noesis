import { clsx } from 'clsx';
import { cloneElement, type ReactElement } from 'react';
import { CardTooltip } from '#/shared/design-system/card-tooltip.tsx';
import { shortLabel, shortName } from '#/shared/ui/qualified-name.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type ChangeListItem,
  parameterItems,
  propertyItems,
  resultItems,
} from './change-list-items.ts';
import { findById } from './change-set.ts';
import { useDesignDocument } from './design-document-context.ts';
import classes from './element-tooltip.module.css';

/** One declaration as the tooltip lists it: its name, if any, and its type read short. */
interface Line {
  key: string;
  name?: string;
  type?: string;
}

/** What the design says an element is made of, as the tooltip lists it. */
interface Shape {
  properties?: Line[];
  input?: Line[];
  output?: Line[];
}

/** The address a name points at: `name: a.b.C[]` points at `a.b.C`. */
const addressOf = (name: string) =>
  name
    .slice(name.indexOf(':') + 1)
    .trim()
    .replace(/(\[\])+$/, '');

/** Each line as declared, its type read short; what the design removes left out. */
const lines = (items: ChangeListItem[]): Line[] =>
  items
    .filter(({ change }) => change !== 'removed')
    .map(({ label, name, type }) =>
      name === undefined && type === undefined
        ? { key: label, name: label }
        : {
            key: label,
            name,
            type: type === undefined ? undefined : shortName(type).type,
          },
    );

/** The shape the document gives the element at an address, if it gives one. */
const shapeOf = (doc: DesignDocumentInput, address: string): Shape | null => {
  const block = findById(doc.buildingBlocks, `building_block|${address}`);
  if (block) {
    const properties = lines(propertyItems(block.id, block.properties));
    return properties.length > 0 ? { properties } : null;
  }
  const behaviour = findById(doc.behaviours, `behavior|${address}`);
  if (behaviour) {
    const input = lines(parameterItems(behaviour.input));
    const output = lines(resultItems(behaviour.output));
    return input.length + output.length > 0 ? { input, output } : null;
  }
  return null;
};

/**
 * What an element is, on hover over whatever names it — a word, a box, a
 * whole card: its address in full, and the properties, or the input and
 * output, the design gives it. Descriptions stay in the panel; this is the
 * outline at a glance. An element the document does not shape gets its
 * address alone, and a name with nothing to cut and nothing to say gets no
 * tooltip at all.
 *
 * `name` is the element's qualified name, `a.b.C` or `name: a.b.C`; the
 * child is what the tooltip opens over, so it must take a ref.
 */
export function ElementTooltip({
  name,
  shown = shortLabel(name),
  hint,
  children,
}: {
  name: string;
  /**
   * What the child shows of the name, its short label by default. An input
   * shown by its name alone still has its type to say, even a primitive's.
   */
  shown?: string;
  /**
   * Marks the child with a help cursor while it has something to say — for
   * a bare word, which nothing else shows can be hovered.
   */
  hint?: boolean;
  children: ReactElement<{ className?: string }>;
}) {
  const doc = useDesignDocument();
  const address = addressOf(name);
  const shape = doc === null ? null : shapeOf(doc, address);
  if (shape === null && shown === name.trim()) {
    return children;
  }
  return (
    <CardTooltip
      openDelay={300}
      multiline
      maw={360}
      label={<Details address={address} shape={shape} />}
    >
      {hint
        ? cloneElement(children, {
            className: clsx(children.props.className, classes.hint),
          })
        : children}
    </CardTooltip>
  );
}

function Details({ address, shape }: { address: string; shape: Shape | null }) {
  return (
    <span className={classes.details}>
      <span className={classes.address}>{address}</span>
      <Lines label="Properties" lines={shape?.properties} />
      <Lines label="Input" lines={shape?.input} />
      <Lines label="Output" lines={shape?.output} />
    </span>
  );
}

/** One group, left out when there is nothing in it. Spans: a tooltip's label is phrasing. */
function Lines({ label, lines }: { label: string; lines: Line[] | undefined }) {
  if (lines === undefined || lines.length === 0) return null;
  return (
    <span className={classes.group}>
      <span className={classes.label}>{label}</span>
      {lines.map(({ key, name, type }) => (
        // `name: Type`, the type in the colour a declaration box gives it.
        <span key={key} className={classes.line}>
          {name}
          {name !== undefined && type !== undefined && ': '}
          {type !== undefined && <span className={classes.type}>{type}</span>}
        </span>
      ))}
    </span>
  );
}
