/*
 * A name written out for a reader: every word begins in upper case and runs on
 * in lower, and the breaks between the words are left exactly as they were. A
 * `_` breaks a word as a space does, because that is how the model spells its
 * patterns — `application_service` is two words, and comes back as
 * `Application_Service` rather than as one word with a mark in the middle.
 */

/**
 * What `titleCase` does, said in the type: a literal in gives the titled
 * literal out, so `titleCase('domain_event')` is `'Domain_Event'` and not
 * merely `string`.
 *
 * A value known only to be a `string` is answered with `string` and nothing
 * narrower. Without that first line it would be answered with
 * `Capitalize<Lowercase<string>>`, which the compiler leaves standing rather
 * than reducing: a type assignable to `string` that `string` is not assignable
 * to, so a caller could not even compare what came back with a string of their
 * own. `string extends S` is true of `string` alone and of no literal.
 *
 * The head of a split is titled again rather than capitalised, or splitting at
 * the first space would leave the underscores inside that head untouched. One
 * step of recursion per word, so the compiler's own depth limit is the ceiling
 * on how long a literal can be — names, not prose.
 */
export type TitleCase<S extends string> = string extends S
  ? string
  : S extends `${infer W} ${infer R}`
    ? `${TitleCase<W>} ${TitleCase<R>}`
    : S extends `${infer W}_${infer R}`
      ? `${TitleCase<W>}_${TitleCase<R>}`
      : Capitalize<Lowercase<S>>;

/** A run of anything that is not a break, which is what a word is here. */
const WORD = /[^ _]+/gu;

export function titleCase<S extends string>(text: S): TitleCase<S> {
  // No compiler reads a regular expression, so the type above is the promise
  // and this line is the one place that has to keep it.
  return text.replace(
    WORD,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  ) as TitleCase<S>;
}
