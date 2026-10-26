import { IconFileText } from '@tabler/icons-react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useId } from 'react';
import { ChangePicker } from '#/features/changes/ui/change-picker.tsx';
import { Box } from '#/shared/design-system/box';
import { NavLink } from '#/shared/design-system/nav-link';
import { ScrollArea } from '#/shared/design-system/scroll-area';
import { Text } from '#/shared/design-system/text';
import { Tooltip } from '#/shared/design-system/tooltip';
import { UnstyledButton } from '#/shared/design-system/unstyled-button';
import {
  ACTIVE_OPTIONS,
  APP_PUBLIC_NAV,
  DESIGN_DOCS_NAV,
  DOCUMENTS_NAV,
  type NavItem,
} from '#/shell/navigation/nav-items.ts';
import {
  type ChangeNavChild,
  useChangeNav,
} from '#/shell/navigation/use-change-nav.ts';
import { RailIcons } from './rail-icons.tsx';
import { DesignDocTile, DesignDocViews } from './rail-parts.tsx';
import classes from './rail.module.css';

/** A row's label runs on to a second line rather than being cut off. */
const ROW_PARTS = { label: classes.rowLabel };

interface RailProps {
  /** Folded to a column of icons, each opening what it holds beside it. */
  collapsed: boolean;
  onToggle: () => void;
  /** Called on every move, so a phone's rail folds away behind it. */
  onNavigate?: () => void;
}

/**
 * The app's navigation down the left, open or folded to icons, with the
 * toggle between the two sitting on its right edge.
 */
export function Rail({ collapsed, onToggle, onNavigate }: RailProps) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse to icons';
  const Icon = collapsed ? IconChevronRight : IconChevronLeft;
  return (
    <Box
      component="nav"
      aria-label="Main"
      className={classes.frame}
      data-collapsed={collapsed || undefined}
    >
      {collapsed ? (
        <RailIcons onNavigate={onNavigate} />
      ) : (
        <RailList onNavigate={onNavigate} />
      )}
      {/* The strip along the rail's edge, between the card and the border:
          the toggle comes up in full when the pointer is in it. */}
      <Box className={classes.edge}>
        <Tooltip label={label} position="right">
          <UnstyledButton
            className={classes.toggle}
            aria-label={label}
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            <Icon size={12} stroke={2} aria-hidden />
          </UnstyledButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

interface RailListProps {
  onNavigate: (() => void) | undefined;
}

/**
 * The app's navigation down the left: the change you are in as one card — its
 * picker at the head, then its overview, its documents and its design docs —
 * and below it, at the foot of the rail, the system model. The open design doc unfolds the ways it is
 * read, each a link of its own.
 */
function RailList({ onNavigate }: RailListProps) {
  const { changes, activeChange, params, children } = useChangeNav();
  const documents = children[DOCUMENTS_NAV.to] ?? [];
  const designDocs = children[DESIGN_DOCS_NAV.to] ?? [];
  const [overview] = APP_PUBLIC_NAV.changes;

  return (
    <Box className={classes.rail}>
      <Box className={classes.card}>
        <Box p={6}>
          <ChangePicker
            changes={changes}
            current={activeChange}
            onNavigate={onNavigate}
          />
        </Box>
        <Box className={classes.divider} />
        <ScrollArea className={classes.list} type="hover">
          <Box className={classes.listInner}>
            {overview && (
              <NavLink
                className={classes.row}
                classNames={ROW_PARTS}
                label={overview.label}
                data-page-tone={overview.tone}
                leftSection={<overview.icon size={17} stroke={1.7} />}
                disabled={activeChange === null}
                onClick={onNavigate}
                renderRoot={(props) => (
                  <Link
                    {...props}
                    to={overview.to}
                    params={params}
                    activeOptions={ACTIVE_OPTIONS}
                    viewTransition
                  />
                )}
              />
            )}

            <Section entry={DOCUMENTS_NAV} count={documents.length}>
              {documents.map((item) => (
                <NavLink
                  key={item.id}
                  className={classes.row}
                  classNames={ROW_PARTS}
                  label={item.name}
                  data-page-tone={DOCUMENTS_NAV.tone}
                  leftSection={<IconFileText size={17} stroke={1.7} />}
                  onClick={onNavigate}
                  renderRoot={(props) => (
                    <Link
                      {...props}
                      {...item.link}
                      activeOptions={ACTIVE_OPTIONS}
                      viewTransition
                    />
                  )}
                />
              ))}
            </Section>

            <Section entry={DESIGN_DOCS_NAV} count={designDocs.length}>
              {designDocs.map((item) =>
                item.open ? (
                  <OpenDesignDoc
                    key={item.id}
                    item={item}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <NavLink
                    key={item.id}
                    className={classes.row}
                    classNames={ROW_PARTS}
                    label={item.name}
                    leftSection={<DesignDocTile open={false} />}
                    onClick={onNavigate}
                    renderRoot={(props) => (
                      <Link
                        {...props}
                        {...item.link}
                        activeOptions={ACTIVE_OPTIONS}
                        viewTransition
                      />
                    )}
                  />
                ),
              )}
            </Section>
          </Box>
        </ScrollArea>
      </Box>

      {APP_PUBLIC_NAV.documentation.map((entry) => (
        <NavLink
          key={entry.to}
          className={classes.appLink}
          label={entry.label}
          leftSection={<entry.icon size={18} stroke={1.7} />}
          onClick={onNavigate}
          renderRoot={(props) => (
            <Link
              {...props}
              to={entry.to}
              activeOptions={ACTIVE_OPTIONS}
              viewTransition
            />
          )}
        />
      ))}
    </Box>
  );
}

interface SectionProps {
  entry: NavItem;
  count: number;
  children: ReactNode;
}

/** A run of a change's items under its small label and how many there are. */
function Section({ entry, count, children }: SectionProps) {
  const labelId = useId();
  return (
    <Box
      // A labelled ARIA group: none of the tags the lint rule suggests
      // describes a run of links under a name.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-labelledby={labelId}
      className={classes.section}
    >
      <Box className={classes.sectionHead}>
        <Box component="span" id={labelId} className={classes.sectionLabel}>
          {entry.label}
        </Box>
        <Box component="span" className={classes.count} aria-hidden>
          {count}
        </Box>
      </Box>
      {children}
    </Box>
  );
}

interface OpenDesignDocProps {
  item: ChangeNavChild;
  onNavigate: (() => void) | undefined;
}

/**
 * The design doc you are in: no longer a link, but the name of the ways it is
 * read, which hang off it. The one being read is the link you are on.
 */
function OpenDesignDoc({ item, onNavigate }: OpenDesignDocProps) {
  const labelId = useId();
  return (
    <Box
      // A labelled ARIA group, as a section is: the doc's views under its name.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-labelledby={labelId}
    >
      <Box className={classes.openDoc}>
        <DesignDocTile open />
        <Text
          component="span"
          id={labelId}
          fw={600}
          size="sm"
          lh={1.35}
          lineClamp={2}
        >
          {item.name}
        </Text>
      </Box>
      <DesignDocViews item={item} onNavigate={onNavigate} />
    </Box>
  );
}
