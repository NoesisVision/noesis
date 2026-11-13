import { IconBraces } from '@tabler/icons-react';
import { clsx } from 'clsx';
import {
  cloneElement,
  Fragment,
  type ReactElement,
  type ReactNode,
} from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import { CardTooltip } from '#/shared/design-system/card-tooltip.tsx';
import {
  behaviorIdAt,
  blockIdAt,
  moduleIdAt,
  nameOf,
  ownerOf,
  parentOf,
} from '#/shared/model/element-id.ts';
import {
  qualifiedOf,
  shortLabel,
  shortName,
} from '#/shared/ui/qualified-name.tsx';
import type {
  DesignDocumentInput,
  DesignedBehaviorInput,
} from '#backend/app/design-docs/design-doc.ts';
import { findById, writtenIn } from '../../change-set.ts';
import { valueOf } from '../../design-doc-field.ts';
import {
  CardinalityMark,
  CardinalityNote,
  type MarkedCardinality,
} from './cardinality-mark.tsx';
import {
  type ChangeListItem,
  parameterItems,
  propertyItems,
  resultItems,
} from './change-list-items.ts';
import { useDesignDocument } from './design-document-context.ts';
import classes from './element-tooltip.module.css';

/**
 * One declaration as the tooltip lists it: its name, if any, and its type
 * read short; marked with what it is, a dot when nothing says.
 */
interface Line {
  key: string;
  /** A declaration's name, or a behavior's signature with its inputs' marks. */
  name?: ReactNode;
  type?: string;
  /** How many of the type it holds, marked before the type, when not exactly one. */
  cardinality?: MarkedCardinality;
  icon?: ReactNode;
}

const ICON_SIZE = 12;

/** What the design says an element is made of, as the tooltip lists it. */
interface Shape {
  properties?: Line[];
  input?: Line[];
  output?: Line[];
  buildingBlocks?: Line[];
  behaviors?: Line[];
}

/** Each line as declared, its type read short; what the design removes left out. */
const lines = (items: ChangeListItem[]): Line[] =>
  items
    .filter(({ change }) => change !== 'removed')
    .map(({ label, name, type, cardinality }) =>
      name === undefined && type === undefined
        ? { key: label, name: label }
        : {
            key: label,
            name,
            type: type === undefined ? undefined : shortName(type).type,
            ...(cardinality === undefined ? {} : { cardinality }),
          },
    );

/**
 * A behavior as a signature: `place(order: Order): Receipt`, its types read
 * short, each input's and the output's gray mark before its type when it
 * holds many or may hold none.
 */
const signatureOf = (
  doc: DesignDocumentInput,
  behavior: DesignedBehaviorInput,
): Line => {
  const inputs = lines(parameterItems(doc, behavior.id));
  // A behavior gives back one thing at most.
  const [output] = lines(resultItems(doc, behavior.id));
  return {
    key: behavior.id,
    name: (
      <>
        {nameOf(behavior.id)}(
        {inputs.map(({ key, name, type, cardinality }, index) => (
          <Fragment key={key}>
            {index > 0 && ', '}
            {name}
            {type !== undefined && ': '}
            {cardinality !== undefined && (
              <CardinalityMark cardinality={cardinality} />
            )}
            {type}
          </Fragment>
        ))}
        )
      </>
    ),
    icon: <KindIcon kind="behavior" pattern={null} size={ICON_SIZE} />,
    ...(output?.type === undefined
      ? {}
      : {
          type: output.type,
          ...(output.cardinality === undefined
            ? {}
            : { cardinality: output.cardinality }),
        }),
  };
};

/** A block's behaviors the document writes, each as its signature. */
const behaviorsOf = (doc: DesignDocumentInput, blockId: string): Line[] =>
  writtenIn(doc.behaviors)
    .filter(({ id }) => ownerOf(id) === blockId)
    .map((behavior) => signatureOf(doc, behavior));

/** A module's building blocks the document writes, each by its name and kind. */
const buildingBlocksOf = (doc: DesignDocumentInput, moduleId: string): Line[] =>
  writtenIn(doc.buildingBlocks)
    .filter(({ id }) => parentOf(id) === moduleId)
    .map((block) => ({
      key: block.id,
      name: nameOf(block.id),
      type: valueOf(block.type) ?? undefined,
    }));

/** Whether any group of a shape has a line in it. */
const isEmpty = (shape: Shape) =>
  Object.values(shape).every((group: Line[] | undefined) => !group?.length);

/**
 * The shape the document gives the element at an address, if it gives one:
 * a behavior's input and output, a building block's properties and
 * behaviors, a module's building blocks.
 */
const shapeOf = (doc: DesignDocumentInput, address: string): Shape | null => {
  // What a behavior takes and gives is written from it, whether or not the
  // document names the behavior itself.
  const behaviorId = behaviorIdAt(address);
  const input = lines(parameterItems(doc, behaviorId));
  const output = lines(resultItems(doc, behaviorId));
  if (input.length + output.length > 0) return { input, output };
  if (findById(doc.behaviors, behaviorId)) return null;
  const blockId = blockIdAt(address);
  const shape: Shape = {
    behaviors: behaviorsOf(doc, blockId),
    properties: lines(propertyItems(doc, blockId)).map((line) => ({
      ...line,
      icon: <IconBraces size={ICON_SIZE} stroke={2} aria-hidden />,
    })),
  };
  if (!isEmpty(shape)) return shape;
  const moduleId = moduleIdAt(address);
  const buildingBlocks = buildingBlocksOf(doc, moduleId);
  return buildingBlocks.length > 0 ? { buildingBlocks } : null;
};

/**
 * What an element is, on hover over whatever names it — a word, a box, a
 * whole card: its name over where it sits, and what the design gives it — a
 * behavior's input and output, a building block's properties and
 * behaviors, a module's building blocks. Descriptions stay in the panel;
 * this is the outline at a glance. An element the document does not shape
 * gets its address alone, and a name with nothing to cut and nothing to say
 * gets no tooltip at all.
 *
 * `name` is the element's qualified name, `a.b.C` or `name: a.b.C`; the
 * child is what the tooltip opens over, so it must take a ref.
 */
export function ElementTooltip({
  name,
  shown = shortLabel(name),
  hint,
  disabled = false,
  openDelay = 300,
  opened,
  tooltipProps,
  cardinality,
  children,
}: {
  name: string;
  /**
   * How many of the named type a slot holds, when not exactly one: said
   * under the name with its mark, so even a primitive gets a tooltip.
   */
  cardinality?: MarkedCardinality | undefined;
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
  /** Kept shut, as while a menu opened over the child is open. */
  disabled?: boolean;
  /** How long the pointer rests on the child before it opens, in ms. */
  openDelay?: number;
  /** Shown, or not, by whoever holds it, rather than by hovering the child. */
  opened?: boolean;
  /**
   * Set on the floating card itself — a class, data attributes — for a
   * surface that draws it its own way, as a diagram's theme does.
   */
  tooltipProps?: { className?: string } & Record<`data-${string}`, string>;
  children: ReactElement<{ className?: string }>;
}) {
  const doc = useDesignDocument();
  const address = qualifiedOf(name);
  const shape = doc === null ? null : shapeOf(doc, address);
  if (shape === null && shown === name.trim() && cardinality === undefined) {
    return children;
  }
  return (
    <CardTooltip
      {...tooltipProps}
      openDelay={openDelay}
      multiline
      disabled={disabled}
      opened={opened}
      label={
        <Details address={address} shape={shape} cardinality={cardinality} />
      }
    >
      {hint
        ? cloneElement(children, {
            className: clsx(children.props.className, classes.hint),
          })
        : children}
    </CardTooltip>
  );
}

function Details({
  address,
  shape,
  cardinality,
}: {
  address: string;
  shape: Shape | null;
  cardinality: MarkedCardinality | undefined;
}) {
  return (
    <span className={classes.details}>
      <Address address={address} cardinality={cardinality} />
      <Lines label="Behaviors" lines={shape?.behaviors} />
      <Lines label="Properties" lines={shape?.properties} />
      <Lines label="Input" lines={shape?.input} />
      <Lines label="Output" lines={shape?.output} />
      <Lines label="Building blocks" lines={shape?.buildingBlocks} />
    </span>
  );
}

/**
 * The element's address, read as a heading: its name — and after it, for a
 * slot that holds many or may hold none, its mark and word — over where it
 * sits, small and gray. A root module has no place to say.
 */
function Address({
  address,
  cardinality,
}: {
  address: string;
  cardinality: MarkedCardinality | undefined;
}) {
  const dot = address.lastIndexOf('.');
  return (
    <span className={classes.address}>
      <span className={classes.heading}>
        <span className={classes.name}>{address.slice(dot + 1)}</span>
        {cardinality !== undefined && (
          <CardinalityNote cardinality={cardinality} />
        )}
      </span>
      {dot !== -1 && (
        <span className={classes.place}>{address.slice(0, dot)}</span>
      )}
    </span>
  );
}

/** One group, left out when there is nothing in it. Spans: a tooltip's label is phrasing. */
function Lines({ label, lines }: { label: string; lines: Line[] | undefined }) {
  if (lines === undefined || lines.length === 0) return null;
  return (
    <span className={classes.group}>
      <span className={classes.label}>{label}</span>
      {lines.map(({ key, name, type, cardinality, icon }) => (
        // `name: Type`, the type in the colour a declaration box gives it.
        <span
          key={key}
          className={classes.line}
          data-marked={icon === undefined ? undefined : true}
        >
          {icon !== undefined && <span className={classes.icon}>{icon}</span>}
          {name}
          {name !== undefined && type !== undefined && ': '}
          {type !== undefined && (
            <span className={classes.type}>
              {cardinality !== undefined && (
                <CardinalityMark cardinality={cardinality} />
              )}
              {type}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * A list under a title, in the card the types' tooltip is drawn on: a rule's
 * scenarios under the rule's name, say. Nothing to list, no tooltip.
 */
export function ListTooltip({
  title,
  label,
  items,
  children,
}: {
  title: string;
  /** What the items are, over them: "Scenarios". */
  label: string;
  items: readonly string[];
  children: ReactElement;
}) {
  if (items.length === 0) return children;
  return (
    <CardTooltip
      openDelay={300}
      multiline
      label={
        <span className={classes.details}>
          <span className={classes.title}>{title}</span>
          <Lines
            label={label}
            lines={items.map((item, index) => ({
              key: `${index}`,
              name: item,
            }))}
          />
        </span>
      }
    >
      {children}
    </CardTooltip>
  );
}
