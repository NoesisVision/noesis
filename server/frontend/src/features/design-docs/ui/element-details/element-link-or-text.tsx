import type { ComponentPropsWithRef, ReactNode } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { useElementNavigation } from './element-navigation.ts';

/**
 * An element's name, or a type's, that opens its row when the tree has
 * one, and is only text when it has none. Struck through when the design
 * removes it. A tooltip round it hands it its ref and its handlers, so
 * whatever else it is given lands on what it draws.
 */
export function ElementLinkOrText({
  path,
  className,
  removed = false,
  children,
  ...rest
}: {
  /** The row it opens; none for text alone. */
  path: string | null | undefined;
  className?: string | undefined;
  removed?: boolean;
  children: ReactNode;
} & Omit<ComponentPropsWithRef<'span'>, 'children' | 'className'> &
  Record<`data-${string}`, unknown>) {
  const { has, select } = useElementNavigation();
  const struck = removed || undefined;
  return path != null && has(path) ? (
    <UnstyledButton
      {...(rest as ComponentPropsWithRef<'button'>)}
      className={className}
      data-link
      data-removed={struck}
      onClick={() => select(path)}
    >
      {children}
    </UnstyledButton>
  ) : (
    <span {...rest} className={className} data-removed={struck}>
      {children}
    </span>
  );
}
