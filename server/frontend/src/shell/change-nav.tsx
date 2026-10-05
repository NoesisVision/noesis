import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import {
  type ReactNode,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Box } from '#/shared/design-system/box';
import { Menu } from '#/shared/design-system/menu';
import { NavLink } from '#/shared/design-system/nav-link';
import { Tooltip } from '#/shared/design-system/tooltip';
import { UnstyledButton } from '#/shared/design-system/unstyled-button';
import {
  type ChangeNavFit,
  type ChangeNavWidths,
  fitChangeNav,
} from '#/shell/navigation/fit-change-nav.ts';
import {
  ACTIVE_OPTIONS,
  APP_PUBLIC_NAV,
  type NavItem,
} from '#/shell/navigation/nav-items.ts';
import {
  type ChangeNavChild,
  useChangeNav,
} from '#/shell/navigation/use-change-nav.ts';
import classes from './change-nav.module.css';

/** A change view, with its named items when it has them. */
interface ChangeNavGroup {
  entry: NavItem;
  items: ChangeNavChild[] | undefined;
}

/**
 * The header's bar: the open change's Overview and its items grouped under
 * small labels — Documents, Design docs — on the left, and the app-wide views
 * on the right. A group's label names it and is not a link; it becomes the
 * menu of its items once none of them fit beside it.
 */
export function ChangeNav() {
  const { activeChange, params, children } = useChangeNav();
  const groups: ChangeNavGroup[] = APP_PUBLIC_NAV.changes.map((entry) => ({
    entry,
    items: children[entry.to],
  }));

  const rowRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const fit = useChangeNavFit(rowRef, measureRef, groups);

  return (
    <Box component="nav" aria-label="Main" ref={rowRef} className={classes.row}>
      {groups.map(({ entry, items }, g) =>
        items === undefined ? (
          <ViewTab
            key={entry.to}
            entry={entry}
            params={params}
            disabled={activeChange === null}
          />
        ) : (
          <ItemGroup
            key={entry.to}
            entry={entry}
            items={items}
            shown={fit?.shown[g] ?? items.map((_, i) => i)}
          />
        ),
      )}
      <Box className={classes.spacer} />
      <AppLinks compact={fit?.compactApp ?? false} />
      <MeasureLayer ref={measureRef} groups={groups} />
    </Box>
  );
}

interface ViewTabProps {
  entry: NavItem;
  params: { changeId: string };
  disabled: boolean;
}

/** A view of the change that is a page of its own: Overview. */
function ViewTab({ entry, params, disabled }: ViewTabProps) {
  return (
    <NavLink
      className={classes.tab}
      label={entry.label}
      leftSection={<entry.icon size={18} stroke={1.6} />}
      disabled={disabled}
      renderRoot={(props) => (
        <Link
          {...props}
          to={entry.to}
          params={params}
          activeOptions={ACTIVE_OPTIONS}
        />
      )}
    />
  );
}

function GroupLabel({ entry, id }: { entry: NavItem; id?: string }) {
  return (
    <Box component="span" id={id} className={classes.label}>
      <entry.icon size={14} stroke={1.8} aria-hidden />
      {entry.label}
    </Box>
  );
}

interface ItemGroupProps {
  entry: NavItem;
  items: ChangeNavChild[];
  /** The indices of the items that fit in the bar. */
  shown: number[];
}

/**
 * A group's label and as many of its items as fit, the rest behind `+N`;
 * with none of them fitting, the label itself opens the menu of all of them.
 */
function ItemGroup({ entry, items, shown }: ItemGroupProps) {
  const labelId = useId();
  const hidden = items.filter((_, i) => !shown.includes(i));

  if (items.length > 0 && shown.length === 0) {
    return (
      <Box className={classes.itemGroup}>
        <ItemsMenu label={entry.label} items={items}>
          <UnstyledButton className={classes.labelMenu}>
            <entry.icon size={14} stroke={1.8} aria-hidden />
            {entry.label}
            <IconChevronDown size={12} stroke={2} aria-hidden />
          </UnstyledButton>
        </ItemsMenu>
      </Box>
    );
  }

  return (
    <Box
      // A labelled ARIA group: none of the tags the lint rule suggests
      // describes a run of links under a name.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-labelledby={labelId}
      className={classes.itemGroup}
    >
      <GroupLabel entry={entry} id={labelId} />
      {shown.map((i) => {
        const item = items[i];
        return item ? <ItemTab key={item.id} item={item} /> : null;
      })}
      {hidden.length > 0 && (
        <ItemsMenu label={entry.label} items={hidden}>
          <UnstyledButton
            className={classes.more}
            aria-label={`More ${entry.label.toLowerCase()} (${hidden.length})`}
          >
            +{hidden.length}
            <IconChevronDown size={12} stroke={2} aria-hidden />
          </UnstyledButton>
        </ItemsMenu>
      )}
    </Box>
  );
}

function ItemTab({ item }: { item: ChangeNavChild }) {
  return (
    <NavLink
      className={classes.tab}
      data-item
      label={item.name}
      noWrap
      renderRoot={(props) => (
        <Link {...props} {...item.link} activeOptions={ACTIVE_OPTIONS} />
      )}
    />
  );
}

interface ItemsMenuProps {
  /** The group the items belong to. */
  label: string;
  items: ChangeNavChild[];
  /** The trigger: `+N` after the items, or the group's label. */
  children: ReactNode;
}

/** A group's items that are not in the bar. */
function ItemsMenu({ label, items, children }: ItemsMenuProps) {
  return (
    <Menu position="bottom-start" shadow="md" width={260} offset={4}>
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown mah={360} style={{ overflowY: 'auto' }}>
        <Menu.Label>{label}</Menu.Label>
        {items.map((item) => (
          <Menu.Item
            key={item.id}
            rightSection={item.open ? <IconCheck size={14} /> : null}
            renderRoot={(props) => (
              <Link {...props} {...item.link} activeOptions={ACTIVE_OPTIONS} />
            )}
          >
            {item.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

interface AppLinksProps {
  /** Icons only, each named by its tooltip. */
  compact: boolean;
}

/** The views that are not about a change: the documentation. */
function AppLinks({ compact }: AppLinksProps) {
  return (
    <>
      {APP_PUBLIC_NAV.documentation.map((entry) => (
        <Tooltip key={entry.to} label={entry.label} disabled={!compact}>
          <NavLink
            className={classes.tab}
            label={compact ? undefined : entry.label}
            aria-label={compact ? entry.label : undefined}
            leftSection={<entry.icon size={18} stroke={1.6} />}
            renderRoot={(props) => (
              <Link {...props} to={entry.to} activeOptions={ACTIVE_OPTIONS} />
            )}
          />
        </Tooltip>
      ))}
    </>
  );
}

interface MeasureLayerProps {
  ref: RefObject<HTMLDivElement | null>;
  groups: ChangeNavGroup[];
}

/**
 * Every piece of the bar laid out once, unseen and at its natural width, so
 * the bar can choose what fits before it shows anything. Spans, not links: the
 * page has one set of links, the bar's own.
 */
function MeasureLayer({ ref, groups }: MeasureLayerProps) {
  const sample = (entry: NavItem, label: boolean) => (
    <NavLink
      key={entry.to}
      component="span"
      className={classes.tab}
      label={label ? entry.label : undefined}
      leftSection={<entry.icon size={18} stroke={1.6} />}
    />
  );
  const appSample = (label: boolean) => (
    <>{APP_PUBLIC_NAV.documentation.map((entry) => sample(entry, label))}</>
  );
  const labelled = groups.filter(({ items }) => items !== undefined);
  const first = labelled[0]?.entry;
  return (
    <Box ref={ref} aria-hidden className={classes.measure}>
      <Box component="span" data-measure="fixed" className={classes.group}>
        {groups.map(({ entry, items }) =>
          items === undefined ? (
            sample(entry, true)
          ) : (
            <Box component="span" key={entry.to} className={classes.itemGroup}>
              <GroupLabel entry={entry} />
            </Box>
          ),
        )}
      </Box>
      <Box component="span" data-measure="app" className={classes.group}>
        {appSample(true)}
      </Box>
      <Box
        component="span"
        data-measure="app-compact"
        className={classes.group}
      >
        {appSample(false)}
      </Box>
      <UnstyledButton
        component="span"
        data-measure="more"
        className={classes.more}
      >
        +99
        <IconChevronDown size={12} stroke={2} />
      </UnstyledButton>
      {first && (
        <>
          <Box component="span" data-measure="label">
            <GroupLabel entry={first} />
          </Box>
          <UnstyledButton
            component="span"
            data-measure="label-menu"
            className={classes.labelMenu}
          >
            <first.icon size={14} stroke={1.8} />
            {first.label}
            <IconChevronDown size={12} stroke={2} />
          </UnstyledButton>
        </>
      )}
      {groups.map(({ entry, items }, g) => (
        <Box
          key={entry.to}
          component="span"
          data-measure={`group-${g}`}
          className={classes.group}
        >
          {items?.map((item) => (
            <NavLink
              key={item.id}
              component="span"
              className={classes.tab}
              data-item
              data-open={item.open || undefined}
              label={item.name}
              noWrap
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/** The room an element takes in its row: its box and its side margins. */
function outerWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return (
    element.offsetWidth +
    Number.parseFloat(style.marginLeft) +
    Number.parseFloat(style.marginRight)
  );
}

function readWidths(
  row: HTMLElement,
  measure: HTMLElement,
  opens: number[],
): ChangeNavWidths {
  const width = (selector: string) => {
    const element = measure.querySelector<HTMLElement>(selector);
    return element ? outerWidth(element) : 0;
  };
  const rowStyle = getComputedStyle(row);
  return {
    row:
      row.clientWidth -
      Number.parseFloat(rowStyle.paddingLeft) -
      Number.parseFloat(rowStyle.paddingRight),
    fixed: width('[data-measure="fixed"]'),
    app: width('[data-measure="app"]'),
    appCompact: width('[data-measure="app-compact"]'),
    more: width('[data-measure="more"]'),
    labelMenu:
      width('[data-measure="label-menu"]') - width('[data-measure="label"]'),
    groups: opens.map((open, g) => ({
      open,
      widths: [
        ...measure.querySelectorAll<HTMLElement>(
          `[data-measure="group-${g}"] > *`,
        ),
      ].map(outerWidth),
    })),
  };
}

function sameFit(a: ChangeNavFit | null, b: ChangeNavFit): boolean {
  return (
    a !== null &&
    a.compactApp === b.compactApp &&
    JSON.stringify(a.shown) === JSON.stringify(b.shown)
  );
}

/**
 * What fits in the bar, measured after every layout and again whenever the
 * bar or its pieces change size — a resized window, a font that loaded late.
 * `null` until the first measurement: the bar then shows everything.
 */
function useChangeNavFit(
  rowRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLDivElement | null>,
  groups: ChangeNavGroup[],
): ChangeNavFit | null {
  const [fit, setFit] = useState<ChangeNavFit | null>(null);
  // Which item of each group is open, as a value the effect can depend on.
  const opens = groups
    .map(({ items }) => items?.findIndex((item) => item.open) ?? -1)
    .join(',');
  // What the bar holds; the measure layer re-renders from it, so re-measure.
  const contents = JSON.stringify(
    groups.map(({ items }) => items?.map(({ name }) => name)),
  );

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const open = opens.split(',').map(Number);
    const update = () => {
      // Hidden below the breakpoint: nothing to fit until it shows again.
      if (row.clientWidth === 0) return;
      const next = fitChangeNav(readWidths(row, measure, open));
      setFit((current) => (sameFit(current, next) ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [opens, contents, rowRef, measureRef]);

  return fit;
}
