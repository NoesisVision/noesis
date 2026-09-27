import { describe, expect, it } from 'bun:test';
import { titleCase } from '../src/shared/ui/title-case';

describe('titleCase', () => {
  it.each([
    ['aggregate', 'Aggregate'],
    ['AGGREGATE', 'Aggregate'],
    ['mIxEd', 'Mixed'],
    ['domain event', 'Domain Event'],
    ['application_service', 'Application_Service'],
    ['value_object read in place', 'Value_Object Read In Place'],
  ])('writes %j as %j', (text, titled) => {
    expect(titleCase(text)).toBe(titled);
  });

  it.each([
    ['', ''],
    [' ', ' '],
    ['_', '_'],
    ['a  b', 'A  B'],
    ['_leading', '_Leading'],
    ['trailing ', 'Trailing '],
  ])('leaves the breaks in %j exactly as they are, giving %j', (text, kept) => {
    expect(titleCase(text)).toBe(kept);
  });
});
