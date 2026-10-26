/*
 * A rule's description, read as the parts a rule is written in where it
 * names them: what sets it off, what must hold first, how it goes, what holds
 * after, and its edge cases. A description that names fewer than two of them
 * is read as it is written.
 */

/** The parts a rule may be written in, in the order they are read. */
const RULE_PARTS = [
  'Trigger',
  'Pre-conditions',
  'Algorithm',
  'Post-conditions',
  'Edge cases',
] as const;

type RulePartName = (typeof RULE_PARTS)[number];

/** One part: its name, its text, and — an algorithm in numbered steps — its steps. */
export interface RulePart {
  name: RulePartName;
  text: string;
  steps: string[] | null;
}

/** Each part's label as it may be written: `Pre-conditions:`, `Preconditions:`, `Edge case:`. */
const LABEL =
  /(?:^|\s)\**(Trigger|Pre-?conditions?|Algorithm|Post-?conditions?|Edge cases?)\**\s*:\**\s*/gi;

const nameOf = (label: string): RulePartName => {
  const word = label.toLowerCase().replace('-', '');
  if (word.startsWith('trigger')) return 'Trigger';
  if (word.startsWith('precondition')) return 'Pre-conditions';
  if (word.startsWith('algorithm')) return 'Algorithm';
  if (word.startsWith('postcondition')) return 'Post-conditions';
  return 'Edge cases';
};

/** Numbered steps written in a run, `1. … 2. … 3. …`; none for fewer than two. */
export function stepsOf(text: string): string[] | null {
  const marks = [...text.matchAll(/(?:^|\s)(\d+)\.\s+/g)];
  const numbered = marks.every((mark, index) => Number(mark[1]) === index + 1);
  if (marks.length < 2 || !numbered || marks[0]!.index !== 0) return null;
  return marks.map((mark, index) => {
    const start = mark.index + mark[0].length;
    const end = marks[index + 1]?.index ?? text.length;
    return text.slice(start, end).trim();
  });
}

/**
 * The description by its parts, in the order it gives them; null when it
 * names fewer than two, or says something before the first.
 */
export function ruleParts(description: string): RulePart[] | null {
  const text = description.trim();
  const labels = [...text.matchAll(LABEL)];
  if (labels.length < 2 || labels[0]!.index !== 0) return null;
  return labels.map((label, index) => {
    const start = label.index + label[0].length;
    const end = labels[index + 1]?.index ?? text.length;
    const part = text.slice(start, end).trim();
    const name = nameOf(label[1]!);
    return {
      name,
      text: part,
      steps: name === 'Algorithm' ? stepsOf(part) : null,
    };
  });
}
