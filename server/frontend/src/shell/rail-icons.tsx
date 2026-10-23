import { IconFileText } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { ChangePicker } from '#/features/changes/ui/change-picker.tsx';
import { Box } from '#/shared/design-system/box';
import { NavLink } from '#/shared/design-system/nav-link';
import { Tooltip } from '#/shared/design-system/tooltip';
import {
  ACTIVE_OPTIONS,
  APP_PUBLIC_NAV,
  DESIGN_DOCS_NAV,
  DOCUMENTS_NAV,
} from '#/shell/navigation/nav-items.ts';
import {
  type ChangeNavChild,
  useChangeNav,
} from '#/shell/navigation/use-change-nav.ts';
import { DesignDocTile } from './rail-parts.tsx';
import classes from './rail.module.css';

/** An icon-only link: no label box beside the icon, no gap before it. */
const ICON_PARTS = { section: classes.iconSection, body: classes.iconBody };

interface RailIconsProps {
  onNavigate: (() => void) | undefined;
}

/**
 * The rail folded to icons: the change's card on top — its tile, its
 * overview, then one icon for each of its documents and each of its design
 * docs, each a link straight to it and named by its tooltip — and the system
 * model at the foot.
 */
export function RailIcons({ onNavigate }: RailIconsProps) {
  const { changes, activeChange, params, children } = useChangeNav();
  const documents = children[DOCUMENTS_NAV.to] ?? [];
  const designDocs = children[DESIGN_DOCS_NAV.to] ?? [];
  const [overview] = APP_PUBLIC_NAV.changes;

  return (
    <Box className={classes.icons}>
      <Box className={classes.iconCard}>
        <ChangePicker
          compact
          changes={changes}
          current={activeChange}
          onNavigate={onNavigate}
        />
        {overview && (
          <Tooltip label={overview.label} position="right">
            <NavLink
              className={clsx(classes.row, classes.iconRow)}
              classNames={ICON_PARTS}
              aria-label={overview.label}
              leftSection={<overview.icon size={19} stroke={1.7} />}
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
          </Tooltip>
        )}

        {documents.length > 0 && <Box className={classes.iconDivider} />}
        {documents.map((item) => (
          <ItemIcon
            key={item.id}
            item={item}
            kind={DOCUMENTS_NAV.label}
            icon={<IconFileText size={19} stroke={1.7} />}
            onNavigate={onNavigate}
          />
        ))}

        {designDocs.length > 0 && <Box className={classes.iconDivider} />}
        {designDocs.map((item) => (
          <ItemIcon
            key={item.id}
            item={item}
            kind={DESIGN_DOCS_NAV.label}
            icon={<DesignDocTile open={item.open} size={26} />}
            onNavigate={onNavigate}
          />
        ))}
      </Box>

      {/* The app's own place, apart from the change: at the foot of the rail. */}
      <Box className={classes.foot} />
      {APP_PUBLIC_NAV.documentation.map((entry) => (
        <Tooltip key={entry.to} label={entry.label} position="right">
          <NavLink
            className={clsx(classes.appLink, classes.iconLink)}
            classNames={ICON_PARTS}
            aria-label={entry.label}
            leftSection={<entry.icon size={19} stroke={1.7} />}
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
        </Tooltip>
      ))}
    </Box>
  );
}

interface ItemIconProps {
  item: ChangeNavChild;
  /** The section it belongs to, which the tooltip names above it. */
  kind: string;
  icon: ReactNode;
  onNavigate: (() => void) | undefined;
}

/** One document or design doc of the change, as an icon linking to it. */
function ItemIcon({ item, kind, icon, onNavigate }: ItemIconProps) {
  return (
    <Tooltip
      label={
        <>
          <Box component="span" className={classes.tooltipKind}>
            {kind}
          </Box>
          {item.name}
        </>
      }
      position="right"
      multiline
      maw={260}
    >
      <NavLink
        className={clsx(classes.row, classes.iconRow)}
        classNames={ICON_PARTS}
        aria-label={item.name}
        leftSection={icon}
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
    </Tooltip>
  );
}
