import {
  CucumberExpression,
  type Expression,
  ParameterTypeRegistry,
  RegularExpression,
} from '@cucumber/cucumber-expressions';

/*
 * A step definition's expression, matched to a step's text as Cucumber
 * matches it: a regular expression when it starts with `^` or ends with
 * `$`, a Cucumber expression (`the customer adds {int} lines`) otherwise,
 * with Cucumber's built-in parameter types.
 */

const registry = new ParameterTypeRegistry();

export class StepExpression {
  readonly source: string;
  private readonly expression: Expression;

  private constructor(source: string, expression: Expression) {
    this.source = source;
    this.expression = expression;
  }

  /** The expression `source` spells; an `Error` saying why when it is none, e.g. a parameter type the registry lacks. */
  static of(source: string): StepExpression | Error {
    const expression = createExpression(source);
    return expression instanceof Error
      ? expression
      : new StepExpression(source, expression);
  }

  matches(text: string): boolean {
    return this.expression.match(text) !== null;
  }
}

/** The library reports a malformed expression only by throwing; every error it throws is about the expression. */
function createExpression(source: string): Expression | Error {
  try {
    return source.startsWith('^') || source.endsWith('$')
      ? new RegularExpression(new RegExp(source), registry)
      : new CucumberExpression(source, registry);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
