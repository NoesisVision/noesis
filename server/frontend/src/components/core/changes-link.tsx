import { Link } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import { useChangeId } from '#/components/core/use-change-id.ts';
import {
  Anchor,
  type AnchorProps,
} from '#/components/design-system/anchor.tsx';
import type { ChangeRoutePaths } from '#/routes/routes.ts';
import type { FileRoutesByFullPath } from '#/routeTree.gen.ts';

type ChangeParams<TTo extends ChangeRoutePaths> = Omit<
  FileRoutesByFullPath[TTo]['types']['allParams'],
  'changeId'
> & { changeId?: never };

type ChangesLinkProps = Omit<AnchorProps, 'component'> &
  PropsWithChildren &
  (
    | {
        // biome-ignore lint/complexity/noBannedTypes: `{} extends T` is the test for "T has no required property", which decides whether `params` may be omitted.
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
