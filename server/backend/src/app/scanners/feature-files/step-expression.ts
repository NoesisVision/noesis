import {
  CucumberExpression,
  type Expression,
  ParameterTypeRegistry,
  RegularExpression,
} from '@cucumber/cucumber-expressions';

/*
 * A step definition's expression, matched to a step's text as the step
 * library of its language matches it. Each library decides on its own
 * whether a string is a regular expression or a Cucumber expression
 * (`the customer adds {int} lines`), so the decision is a dialect:
 *
 * - `cucumber` (cucumber-jvm's `ExpressionFactory`): a regular expression
 *   when it starts with `^` or ends with `$`, or is written `/…/`; a
 *   Cucumber expression otherwise.
 * - `reqnroll` (Reqnroll's `CucumberExpressionDetector`): a regular
 *   expression when it starts with `^` or ends with `$`, or, holding no
 *   `{parameter}`, when it shows a regular expression's idioms: a group
 *   ending in `*` or `+` such as `(.*)`, a bare `.*`, `\.` or `\d+`. A
 *   Cucumber expression otherwise. Reqnroll anchors a regular expression
 *   at both ends when it is not.
 *
 * Both match a Cucumber expression with Cucumber's built-in parameter types.
 */

export type StepExpressionDialect = 'cucumber' | 'reqnroll';

const registry = new ParameterTypeRegistry();

export class StepExpression {
  readonly source: string;
  private readonly expression: Expression;

  private constructor(source: string, expression: Expression) {
    this.source = source;
    this.expression = expression;
  }

  /** The expression `source` spells in `dialect`; an `Error` saying why when it is none, e.g. a parameter type the registry lacks. */
  static of(
    source: string,
    dialect: StepExpressionDialect,
  ): StepExpression | Error {
    const expression = createExpression(source, dialect);
    return expression instanceof Error
      ? expression
      : new StepExpression(source, expression);
  }

  matches(text: string): boolean {
    return this.expression.match(text) !== null;
  }
}

/** The library reports a malformed expression only by throwing; every error it throws is about the expression. */
function createExpression(
  source: string,
  dialect: StepExpressionDialect,
): Expression | Error {
  try {
    const pattern = DIALECTS[dialect](source);
    return pattern === null
      ? new CucumberExpression(source, registry)
      : new RegularExpression(new RegExp(pattern), registry);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/** The regular expression `source` is in the dialect; `null` when it is a Cucumber expression. */
const DIALECTS: Readonly<
  Record<StepExpressionDialect, (source: string) => string | null>
> = {
  cucumber: (source) => {
    if (isAnchored(source)) return source;
    const scripted = /^\/(.*)\/$/su.exec(source);
    return scripted === null ? null : scripted[1]!;
  },
  reqnroll: (source) => {
    if (isAnchored(source)) return anchored(source);
    if (/\{\w*\}/u.test(source)) return null;
    return /\([^)]+[*+]\)|\.\*/u.test(source) || /\\\.|\\d\+/u.test(source)
      ? anchored(source)
      : null;
  },
};

const isAnchored = (source: string): boolean =>
  source.startsWith('^') || source.endsWith('$');

const anchored = (source: string): string =>
  `${source.startsWith('^') ? '' : '^'}${source}${source.endsWith('$') ? '' : '$'}`;
