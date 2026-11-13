import { IconChevronRight } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import {
  type ModelSlots,
  relationsOfType,
  type WalkStep,
  walkKeyOf,
} from '../../system-model-exploration.ts';
import {
  type Elements,
  kindOf,
  opens,
  RelationGroups,
  relatesToAnything,
  SlotCard,
  slotLabelOf,
  slotNameOf,
  TypeWords,
} from './slot-card.tsx';
import classes from './slot-views.module.css';

/*
 * The other ways a badge's walk is drawn, beside its columns: a tree, one
 * type at a time, and cards nested in cards. Each goes as deep as the
 * reader takes it; a type already passed through is marked and still
 * opens. The tree and the nested cards open where the walk already went,
 * so switching to them keeps the reader's place.
 */

/** The keys of the steps a walk took, past its first: what opens at once. */
const openedBy = (path: readonly WalkStep[]) =>
  new Set(path.slice(1).map((_, index) => walkKeyOf(path, index + 1)));

/** Opens a key, or closes it and all opened under it. */
const toggled = (open: ReadonlySet<string>, key: string) => {
  const next = new Set(open);
  if (next.has(key)) {
    for (const each of open) if (each.startsWith(key)) next.delete(each);
  } else next.add(key);
  return next;
};

// ---------- Tree ----------

/** The walk as one tree: a type's slots under its relations, each opening in place. */
export function SlotTree({
  path,
  slots,
  elements,
}: {
  path: readonly WalkStep[];
  slots: ModelSlots;
  elements: Elements;
}) {
  const [open, setOpen] = useState(() => openedBy(path));
  const [root] = path;
  if (root === undefined) return null;
  return (
    <div className={classes.area}>
      <ul
        className={classes.tree}
        aria-label={`What ${root.typeName} relates to`}
      >
        <Branch
          trail={[root]}
          slots={slots}
          elements={elements}
          open={open}
          onToggle={(key) => setOpen((was) => toggled(was, key))}
        />
      </ul>
    </div>
  );
}

function Branch({
  trail,
  slots,
  elements,
  open,
  onToggle,
}: {
  /** The steps to the type this branch is under, from the badge's own. */
  trail: readonly WalkStep[];
  slots: ModelSlots;
  elements: Elements;
  open: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const relations = relationsOfType(slots, trail.at(-1)!.type);
  const through = new Set(trail.map(({ type }) => type));
  if (!relatesToAnything(relations))
    return <li className={classes.nothing}>nothing inside</li>;
  const groups = [
    ['state', relations.state],
    ['input', relations.input],
    ['output', relations.output],
  ] as const;
  return groups
    .filter(([, rows]) => rows.length > 0)
    .map(([relation, rows]) => (
      <li key={relation} className={classes.treeGroup} data-relation={relation}>
        <span className={classes.treeGroupHead} aria-hidden>
          {relation}
        </span>
        <ul className={classes.treeRows} aria-label={relation}>
          {rows.map((row: WalkStep) => {
            const next = [...trail, row];
            const key = walkKeyOf(next, next.length - 1);
            const leads = opens(row, elements);
            const round = leads && through.has(row.type);
            const isOpen = leads && open.has(key);
            const words = (
              <>
                <span className={classes.twisty} aria-hidden>
                  {leads && <IconChevronRight size={12} stroke={2.4} />}
                </span>
                <span className={classes.treeName}>{slotNameOf(row)}</span>
                {round && (
                  <span className={classes.round} aria-hidden>
                    ↺
                  </span>
                )}
                <span className={classes.treeType}>
                  <TypeWords step={row} />
                </span>
              </>
            );
            return (
              <li key={key}>
                {leads ? (
                  <UnstyledButton
                    className={classes.treeRow}
                    aria-expanded={isOpen}
                    aria-label={slotLabelOf(row, round)}
                    onClick={() => onToggle(key)}
                  >
                    {words}
                  </UnstyledButton>
                ) : (
                  <span className={classes.treeRow} data-leaf>
                    {words}
                  </span>
                )}
                {isOpen && (
                  <ul className={classes.branch} aria-label={row.typeName}>
                    <Branch
                      trail={next}
                      slots={slots}
                      elements={elements}
                      open={open}
                      onToggle={onToggle}
                    />
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </li>
    ));
}

// ---------- One at a time ----------

/**
 * The walk one type at a time, at the popup's full width: a slot card
 * slides the next type in from the right; a step of the path slides back.
 */
export function SlotDrill({
  path,
  onPath,
  slots,
  elements,
}: {
  path: readonly WalkStep[];
  onPath: (path: readonly WalkStep[]) => void;
  slots: ModelSlots;
  elements: Elements;
}) {
  const here = path.at(-1);
  // Which way the walk went last, for the way the new type slides in.
  const [drawn, setDrawn] = useState(path);
  const [way, setWay] = useState<'on' | 'back' | undefined>(undefined);
  if (drawn !== path) {
    setWay(path.length >= drawn.length ? 'on' : 'back');
    setDrawn(path);
  }
  const pane = useRef<HTMLElement>(null);
  const byKey = useRef(false);
  useEffect(() => {
    if (!byKey.current) return;
    byKey.current = false;
    pane.current?.querySelector<HTMLElement>('[data-row]')?.focus();
  }, [path]);
  if (here === undefined) return null;
  const relations = relationsOfType(slots, here.type);
  const through = new Set(path.map(({ type }) => type));
  const kind = kindOf(here.type, elements);
  return (
    <div className={classes.area}>
      <section
        // A new type is a new pane, sliding in.
        key={walkKeyOf(path, path.length - 1)}
        ref={pane}
        className={classes.pane}
        data-way={way}
        aria-label={`${here.typeName}, ${kind}`}
      >
        <div className={classes.paneHead} aria-hidden>
          <span className={classes.paneType}>
            <TypeWords step={here} />
          </span>
          <Text component="span" fz="xs" c="dimmed">
            {relatesToAnything(relations) ? kind : `${kind} · nothing inside`}
          </Text>
        </div>
        <RelationGroups relations={relations}>
          {(row) => (
            <SlotCard
              step={row}
              elements={elements}
              round={through.has(row.type)}
              onOpen={(keys) => {
                byKey.current = keys;
                onPath([...path, row]);
              }}
            />
          )}
        </RelationGroups>
      </section>
    </div>
  );
}

// ---------- Nested cards ----------

/** The walk as cards nested in cards: a slot card opens into its type's own. */
export function SlotNested({
  path,
  slots,
  elements,
}: {
  path: readonly WalkStep[];
  slots: ModelSlots;
  elements: Elements;
}) {
  const [open, setOpen] = useState(() => openedBy(path));
  const [root] = path;
  if (root === undefined) return null;
  return (
    <div className={classes.area}>
      <div className={classes.nest}>
        <Inside
          trail={[root]}
          slots={slots}
          elements={elements}
          open={open}
          onToggle={(key) => setOpen((was) => toggled(was, key))}
        />
      </div>
    </div>
  );
}

function Inside({
  trail,
  slots,
  elements,
  open,
  onToggle,
}: {
  trail: readonly WalkStep[];
  slots: ModelSlots;
  elements: Elements;
  open: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const relations = relationsOfType(slots, trail.at(-1)!.type);
  const through = new Set(trail.map(({ type }) => type));
  if (!relatesToAnything(relations))
    return <span className={classes.nothing}>nothing inside</span>;
  return (
    <RelationGroups relations={relations}>
      {(row) => {
        const next = [...trail, row];
        const key = walkKeyOf(next, next.length - 1);
        const leads = opens(row, elements);
        const isOpen = leads && open.has(key);
        const card = (
          <SlotCard
            step={row}
            elements={elements}
            round={through.has(row.type)}
            expanded={leads ? isOpen : undefined}
            onOpen={() => onToggle(key)}
          />
        );
        if (!leads) return card;
        return (
          <div className={classes.box} data-open={isOpen || undefined}>
            {card}
            {isOpen && (
              <div className={classes.boxInside}>
                <Inside
                  trail={next}
                  slots={slots}
                  elements={elements}
                  open={open}
                  onToggle={onToggle}
                />
              </div>
            )}
          </div>
        );
      }}
    </RelationGroups>
  );
}
