/**
 * What a canvas holds after a card is clicked: taken in hand alone; clicked
 * again, alone in hand, let go of. With Ctrl or Cmd (`adding`) it joins the
 * hand, or leaves it.
 */
export const selectionAfterClick = (
  held: readonly string[],
  id: string,
  adding: boolean,
): readonly string[] =>
  !adding
    ? held.length === 1 && held[0] === id
      ? []
      : [id]
    : held.includes(id)
      ? held.filter((each) => each !== id)
      : [...held, id];
