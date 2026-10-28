/**
 * The Noesis mark, as the brand book (v4) draws it on its 24-unit grid: the
 * system's boundary, a hexagon, and inside it the letter N written as a small
 * graph — four nodes, three edges. One line weight, one colour, no fill; the
 * colour is the text's, so whoever places it says which (`--noesis-brand-mark`
 * in the bar). Under 24px the book thickens the outline and the nodes so the
 * hexagon keeps its shape; `small` is that version.
 */
export function NoesisMark({
  size = 24,
  small = size < 24,
}: {
  size?: number;
  small?: boolean;
}) {
  const node = small ? 1.6 : 1.5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
      style={{ display: 'block', flex: 'none' }}
    >
      <path
        d="M12 1.75L20.75 6.75V17.25L12 22.25L3.25 17.25V6.75Z"
        strokeWidth={small ? 2 : 1.5}
      />
      <path d="M8.5 15.5V8.5L15.5 15.5V8.5" strokeWidth={1.5} />
      <g fill="currentColor" stroke="none">
        <circle cx={8.5} cy={8.5} r={node} />
        <circle cx={8.5} cy={15.5} r={node} />
        <circle cx={15.5} cy={8.5} r={node} />
        <circle cx={15.5} cy={15.5} r={node} />
      </g>
    </svg>
  );
}
