import { describe, expect, it } from 'bun:test';
import { readFeatureFile } from '#backend/app/scanners/feature-files/feature-file';
import { StepExpression } from '#backend/app/scanners/feature-files/step-expression';

const PATH = 'features/orders.feature';
const read = (text: string) => readFeatureFile({ path: PATH, text });
const messages = (text: string) =>
  read(text).diagnostics.map(({ message }) => message);

describe('Reading a feature file', () => {
  it('reads a tagged Rule: as a rule and the Scenario: under it as its scenario', () => {
    const { rules, diagnostics } = read(`Feature: Placing orders

  @validation
  Rule: Non-empty order
    An order must have at least one line.
      Lines are what is bought.

    Scenario: An order without lines is refused
      Not even an empty one.
      Given a customer with no lines picked
      When the customer places the order
      Then the order is refused
`);

    expect<unknown>(diagnostics).toEqual([]);
    expect<unknown>(rules).toEqual([
      {
        name: 'Non-empty order',
        kind: 'validation',
        description:
          'An order must have at least one line.\n  Lines are what is bought.',
        source: { path: PATH, line: 4 },
        scenarios: [
          {
            name: 'An order without lines is refused',
            description: 'Not even an empty one.',
            steps: [
              { kind: 'given', text: 'a customer with no lines picked' },
              { kind: 'when', text: 'the customer places the order' },
              { kind: 'then', text: 'the order is refused' },
            ],
            whenSteps: ['the customer places the order'],
            source: { path: PATH, line: 8 },
          },
        ],
      },
    ]);
  });

  it('gives And, But and * the kind of the step before them, Given at the start', () => {
    const [rule] = read(`Feature: F
  @post
  Rule: R
    Scenario: S
      * a star first
      When one thing
      And another
      Then it holds
      But not this
`).rules;

    expect<unknown>(rule?.scenarios[0]?.steps.map(({ kind }) => kind)).toEqual([
      'given',
      'when',
      'when',
      'then',
      'then',
    ]);
    expect<unknown>(rule?.scenarios[0]?.whenSteps).toEqual([
      'one thing',
      'another',
    ]);
  });

  it("puts the feature's Background, then the rule's, before each scenario's steps", () => {
    const [rule] = read(`Feature: F
  Background:
    Given the feature's start

  @computation
  Rule: R
    Background:
      Given the rule's start

    Scenario: S
      When it runs
`).rules;

    expect<unknown>(rule?.scenarios[0]?.steps).toEqual([
      { kind: 'given', text: "the feature's start" },
      { kind: 'given', text: "the rule's start" },
      { kind: 'when', text: 'it runs' },
    ]);
  });

  it('reads a Scenario Outline as one scenario, its placeholders as written, matched with its first example', () => {
    const [rule] = read(`Feature: F
  @computation
  Rule: R
    Scenario Outline: More lines
      When the customer adds <count> lines of <product>
      Examples:
        | count | product |
        | 2     | tea     |
        | 3     | coffee  |
`).rules;

    expect<unknown>(rule?.scenarios[0]?.steps).toEqual([
      { kind: 'when', text: 'the customer adds <count> lines of <product>' },
    ]);
    expect<unknown>(rule?.scenarios[0]?.whenSteps).toEqual([
      'the customer adds 2 lines of tea',
    ]);
  });

  it('reads tags other than the kind as nothing, and a description-less rule as null', () => {
    const [rule] = read(`Feature: F
  @wip @state_change
  Rule: R
    Scenario: S
      When it runs
`).rules;

    expect<unknown>(rule).toMatchObject({
      kind: 'state_change',
      description: null,
    });
    expect<unknown>(rule?.scenarios[0]?.description).toBeNull();
  });

  it('drops a scenario under no Rule:', () => {
    const text = `Feature: F
  Scenario: Alone
    When it runs
`;

    expect<unknown>(read(text).rules).toEqual([]);
    expect<unknown>(read(text).diagnostics).toEqual([
      {
        message: `${PATH}: scenario "Alone" is under no Rule:, so it illustrates nothing; dropped`,
        source: { path: PATH, line: 2 },
      },
    ]);
  });

  it('drops a rule without a kind tag, or with two', () => {
    const text = `Feature: F
  Rule: Untagged
    Scenario: S
      When it runs

  @validation @post
  Rule: Twice
    Scenario: S
      When it runs
`;

    expect<unknown>(read(text).rules).toEqual([]);
    expect<unknown>(messages(text)).toEqual([
      expect.stringContaining('rule "Untagged" has no kind tag'),
      expect.stringContaining('rule "Twice" has 2 kind tags'),
    ]);
  });

  it('drops a rule or a scenario whose name is no element name', () => {
    const text = `Feature: F
  @validation
  Rule: Orders.lines
    Scenario: S
      When it runs

  @validation
  Rule: Kept
    Scenario: a|b
      When it runs
    Scenario: No steps
`;

    const { rules } = read(text);
    expect<unknown>(rules.map(({ name }) => name)).toEqual(['Kept']);
    expect<unknown>(rules[0]?.scenarios).toEqual([]);
    expect<unknown>(messages(text)).toEqual([
      expect.stringContaining('rule "Orders.lines" has a name that is no'),
      expect.stringContaining('scenario "a|b" has a name that is no'),
      expect.stringContaining('scenario "No steps" has no steps'),
    ]);
  });

  it('reads nothing of a file that is no Gherkin, and says so', () => {
    const text = 'Given a step outside any feature\n';

    expect<unknown>(read(text).rules).toEqual([]);
    expect<unknown>(messages(text)).toEqual([
      expect.stringContaining(`${PATH}: is no Gherkin the parser reads`),
    ]);
  });

  it('reads an empty file as no rules', () => {
    expect<unknown>(read('')).toEqual({ rules: [], diagnostics: [] });
  });

  it('reads a feature in another Gherkin language', () => {
    const [rule] = read(`# language: pl
Właściwość: Zamówienia
  @validation
  Zasada: Niepuste zamówienie
    Scenariusz: Odrzucone
      Kiedy klient składa zamówienie
`).rules;

    expect<unknown>(rule?.name).toBe('Niepuste zamówienie');
    expect<unknown>(rule?.scenarios[0]?.whenSteps).toEqual([
      'klient składa zamówienie',
    ]);
  });
});

describe('A step expression', () => {
  const matches = (source: string, text: string) => {
    const expression = StepExpression.of(source);
    if (expression instanceof Error) throw expression;
    return expression.matches(text);
  };

  it('matches a Cucumber expression with its parameter types', () => {
    expect(
      matches('the customer adds {int} lines', 'the customer adds 2 lines'),
    ).toBe(true);
    expect(
      matches('the customer adds {int} lines', 'the customer adds two lines'),
    ).toBe(false);
    expect(matches('a {string} order', 'a "big" order')).toBe(true);
    expect(matches('the order is/was placed', 'the order was placed')).toBe(
      true,
    );
    expect(matches('the line(s) are added', 'the line are added')).toBe(true);
  });

  it('reads an expression anchored with ^ or $ as a regular expression', () => {
    expect(
      matches('^the total is (?:asked for|read)$', 'the total is read'),
    ).toBe(true);
    expect(
      matches('^the total is (?:asked for|read)$', 'so the total is read'),
    ).toBe(false);
  });

  it('matches the whole text, not a part of it', () => {
    expect(matches('the order is placed', 'the order is placed twice')).toBe(
      false,
    );
  });

  it('is no expression with a parameter type Cucumber does not know', () => {
    expect<unknown>(StepExpression.of('a {customer} orders')).toBeInstanceOf(
      Error,
    );
  });
});
