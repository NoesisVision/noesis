import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { Chevron } from '#/shared/ui/tree/chevron.tsx';
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
import treeClasses from '#/shared/ui/tree/tree.module.css';
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

/**
 * The walk as one tree, drawn as the model tree is (`shared/ui/tree`): a
 * type's relations as items, each holding its slots; a slot opens in
 * place onto what its type relates to. ↑ ↓ move along the rows, → opens,
 * ← shuts, Enter and Space do either.
 */
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
  // The relations shut by the reader; all are open until then.
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set());
  const [root] = path;
  if (root === undefined) return null;

  return (
    <div className={classes.area}>
      <ul
        role="tree"
        className={`${treeClasses.tree} ${classes.tree}`}
        aria-label={`What ${root.typeName} relates to`}
      >
        <Branch
          trail={[root]}
          slots={slots}
          elements={elements}
          open={open}
          shut={shut}
          onToggle={(key) => setOpen((was) => toggled(was, key))}
          onShut={(key) => setShut((was) => toggled(was, key))}
          first
        />
      </ul>
    </div>
  );
}

/** ↑ ↓ along the rows, → opens, ← shuts or goes up, Enter and Space either. */
function onTreeKey(event: KeyboardEvent<HTMLLIElement>) {
  const item = event.currentTarget;
  if (event.target !== item) return;
  const items = [
    ...(item
      .closest('[role="tree"]')
      ?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []),
  ];
  const at = items.indexOf(item);
  const expanded = item.getAttribute('aria-expanded');
  if (event.key === 'ArrowDown') items[at + 1]?.focus();
  else if (event.key === 'ArrowUp') items[at - 1]?.focus();
  else if (
    (event.key === 'ArrowRight' && expanded === 'false') ||
    (event.key === 'ArrowLeft' && expanded === 'true') ||
    ((event.key === 'Enter' || event.key === ' ') && expanded !== null)
  )
    item.click();
  else if (event.key === 'ArrowLeft')
    item.parentElement?.closest<HTMLElement>('[role="treeitem"]')?.focus();
  else return;
  event.preventDefault();
}

function Branch({
  trail,
  slots,
  elements,
  open,
  shut,
  onToggle,
  onShut,
  first = false,
}: {
  /** The steps to the type this branch is under, from the badge's own. */
  trail: readonly WalkStep[];
  slots: ModelSlots;
  elements: Elements;
  open: ReadonlySet<string>;
  shut: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onShut: (key: string) => void;
  /** The tree's first row, the one the Tab key reaches. */
  first?: boolean;
}) {
  const relations = relationsOfType(slots, trail.at(-1)!.type);
  const through = new Set(trail.map(({ type }) => type));
  const here = walkKeyOf(trail, trail.length - 1);
  if (!relatesToAnything(relations))
    return (
      <li role="none" className={`${treeClasses.item} ${classes.nothing}`}>
        nothing inside
      </li>
    );
  const groups = (
    [
      ['state', relations.state],
      ['input', relations.input],
      ['output', relations.output],
    ] as const
  ).filter(([, rows]) => rows.length > 0);
  return groups.map(([relation, rows], index) => {
    const groupKey = `${here} #${relation}`;
    const groupOpen = !shut.has(groupKey);
    return (
      <li
        key={relation}
        role="treeitem"
        tabIndex={first && index === 0 ? 0 : -1}
        aria-expanded={groupOpen}
        aria-label={`${relation}, ${rows.length}`}
        className={treeClasses.item}
        data-relation={relation}
        onClick={(event) => {
          event.stopPropagation();
          onShut(groupKey);
        }}
        onKeyDown={onTreeKey}
      >
        <span className={`${treeClasses.row} ${classes.treeHead}`}>
          <Chevron opens expanded={groupOpen} onToggle={() => {}} />
          {relation}
        </span>
        {groupOpen && (
          <ul
            // The tree pattern owns its subtrees through this role, as the
            // model tree's do; none of the tags the rule suggests is a tree.
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="group"
            className={treeClasses.group}
          >
            {(rows as readonly WalkStep[]).map((row) => {
              const next = [...trail, row];
              const key = walkKeyOf(next, next.length - 1);
              const leads = opens(row, elements);
              const round = leads && through.has(row.type);
              const isOpen = leads && open.has(key);
              return (
                <li
                  key={key}
                  role="treeitem"
                  tabIndex={-1}
                  aria-expanded={leads ? isOpen : undefined}
                  aria-label={slotLabelOf(row, round)}
                  className={treeClasses.item}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (leads) onToggle(key);
                  }}
                  onKeyDown={onTreeKey}
                >
                  <span
                    className={treeClasses.row}
                    data-leaf={leads ? undefined : true}
                  >
                    <Chevron
                      opens={leads}
                      expanded={isOpen}
                      onToggle={() => {}}
                    />
                    <span className={classes.treeName}>{slotNameOf(row)}</span>
                    {round && (
                      <span className={classes.round} aria-hidden>
                        ↺
                      </span>
                    )}
                    <span className={classes.treeType}>
                      <TypeWords step={row} />
                    </span>
                  </span>
                  {isOpen && (
                    <ul
                      // The tree pattern owns its subtrees through this role, as the
                      // model tree's do; none of the tags the rule suggests is a tree.
                      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                      role="group"
                      className={treeClasses.group}
                    >
                      <Branch
                        trail={next}
                        slots={slots}
                        elements={elements}
                        open={open}
                        shut={shut}
                        onToggle={onToggle}
                        onShut={onShut}
                      />
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  });
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
