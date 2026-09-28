import { titleCase, type TitleCase } from '../src/shared/ui/title-case';

// Compile-only checks: the promise of `titleCase` is in its return type, and a
// spec can only see the string that comes back at runtime.
export function checkTitleCase() {
  const one: 'Aggregate' = titleCase('aggregate');
  const shouted: 'Domain Event' = titleCase('DOMAIN EVENT');
  const under: 'Application_Service' = titleCase('application_service');
  const both: 'Foo_Bar Baz' = titleCase('foo_BAR baz');
  const none: '' = titleCase('');
  const named: TitleCase<'domain_event'> = 'Domain_Event';
  // A value known only to be a string says only that a string comes back —
  // and says it in a type a caller can compare with a string of their own.
  const unknown: string = titleCase('aggregate' as string);
  const compared: boolean = unknown === 'Aggregate';
  void compared;
  void [one, shouted, under, both, none, named, unknown];

  // @ts-expect-error The word is titled, not handed back as it came.
  const untitled: 'aggregate' = titleCase('aggregate');
  // @ts-expect-error A break makes the word after it a word of its own.
  const halfTitled: TitleCase<'application_service'> = 'Application_service';
  void [untitled, halfTitled];
}
