import { Link } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import type { FileRoutesByFullPath } from '#/routeTree.gen.ts';
import { Anchor, type AnchorProps } from '#/shared/design-system/anchor.tsx';
import type { ChangeRoutePaths } from '#/shared/routing/route-ids.ts';
import { useChangeId } from '../current-change.ts';

type ChangeParams<TTo extends ChangeRoutePaths> = Omit<
  FileRoutesByFullPath[TTo]['types']['allParams'],
  'changeId'
> & { changeId?: never };

type ChangesLinkProps = Omit<AnchorProps, 'component'> &
  PropsWithChildren &
  (
    | {
        // `{} extends T` tests whether T has any required property, which is
        // what decides if `params` may be omitted.
        [TTo in ChangeRoutePaths]: { to: TTo } & ({} extends ChangeParams<TTo>
          ? { params?: ChangeParams<TTo> }
          : { params: ChangeParams<TTo> });
      }[ChangeRoutePaths]
    | { to: undefined; params?: never }
  );

export function ChangesLink({ to, params, ...props }: ChangesLinkProps) {
  const { changeId } = useChangeId();

  return changeId ? (
    <Anchor
      renderRoot={(anchorProps) => (
        <Link {...anchorProps} to={to} params={{ ...params, changeId }} />
      )}
      {...props}
    />
  ) : (
    props.children
  );
}
