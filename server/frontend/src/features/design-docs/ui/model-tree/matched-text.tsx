import { Highlight } from '#/shared/design-system/highlight.tsx';
import { Text } from '#/shared/design-system/text.tsx';

/**
 * A piece of a row's label, with whatever the query found marked in it.
 * `<mark>` says it in the markup rather than only in a colour, so it survives
 * a reader who cannot see the colour and a test that cannot see the CSS.
 */
export function MatchedText({
  tokens,
  className,
  dimmed,
  children,
}: {
  /** What is being searched for; nothing is marked when there is nothing. */
  tokens: readonly string[];
  className: string;
  /** Set on what the row says about itself, past the name it goes by. */
  dimmed?: boolean;
  children: string;
}) {
  // A monospaced face reads a size larger at the same measure.
  const size = dimmed ? 'xs' : 'sm';
  /*
   * The colour is the stylesheet's, not a prop: `c` lands as an inline style,
   * which no rule can reach past, and the row in hand has to be able to lift
   * what it says about itself off its own background.
   */
  if (tokens.length === 0) {
    return (
      <Text component="span" size={size} className={className}>
        {children}
      </Text>
    );
  }
  return (
    <Highlight
      component="span"
      size={size}
      className={className}
      highlight={[...tokens]}
    >
      {children}
    </Highlight>
  );
}
