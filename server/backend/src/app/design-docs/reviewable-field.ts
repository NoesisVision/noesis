import { z } from 'zod';
import {
  ELEMENT_ADDRESS_SEPARATOR,
  ElementIdSchema,
  ElementNameSchema,
  type ElementId,
} from './element-id';

export function reviewableFieldSchema<Value extends z.ZodType>(value: Value) {
  return z.object({
    value,
    reviewedByHuman: z.boolean().default(false),
  });
}

export interface ReviewableField<T> extends z.infer<
  ReturnType<typeof reviewableFieldSchema<z.ZodType<T>>>
> {}

export function reviewableField<T>(
  value: T,
  reviewedByHuman = false,
): ReviewableField<T> {
  return { value, reviewedByHuman };
}

export const FieldNameSchema = ElementNameSchema.describe(
  "The name of one field of one element, e.g. 'description'. Never empty, never padded with whitespace, and never containing the separator '.'.",
);
export type FieldName = z.infer<typeof FieldNameSchema>;

export const AcceptedFieldSchema = z.object({
  element: ElementIdSchema,
  field: FieldNameSchema,
});
export interface AcceptedField extends z.infer<typeof AcceptedFieldSchema> {}

declare const acceptanceKeyBrand: unique symbol;
type AcceptanceKey = string & { readonly [acceptanceKeyBrand]: true };

/*
 * The set of (element, field) pairs whose modification the user has accepted.
 * Membership is by value, so the pair is flattened into one key: neither a
 * kind, nor an id segment, nor a field name carries the separator, so the key
 * of a pair is unique to it.
 */
export type UserAcceptances = ReadonlySet<AcceptanceKey>;

const acceptanceKey = (element: ElementId, field: FieldName): AcceptanceKey =>
  [element.kind, element.value, FieldNameSchema.parse(field)].join(
    ELEMENT_ADDRESS_SEPARATOR,
  ) as AcceptanceKey;

export function userAcceptances(
  accepted: readonly AcceptedField[],
): UserAcceptances {
  return new Set(
    z
      .array(AcceptedFieldSchema)
      .parse(accepted)
      .map(({ element, field }) => acceptanceKey(element, field)),
  );
}

export const NO_ACCEPTANCES: UserAcceptances = new Set();

export function acceptsField(
  acceptances: UserAcceptances,
  element: ElementId,
  field: FieldName,
): boolean {
  return acceptances.has(acceptanceKey(element, field));
}

export interface ReviewableFieldWrite<T> {
  element: ElementId;
  field: FieldName;
  value: T;
  acceptances: UserAcceptances;
}

/*
 * Writes an unverified value and returns the field it becomes. The value is
 * not reviewed by the human who accepted it — accepting a modification lets it
 * through, it does not vouch for it.
 */
export function writeReviewableField<T>(
  current: ReviewableField<T>,
  { element, field, value, acceptances }: ReviewableFieldWrite<T>,
): ReviewableField<T> {
  if (current.reviewedByHuman && !acceptsField(acceptances, element, field)) {
    throw new ReviewedFieldOverwriteError(current.value, element, field);
  }
  return reviewableField(value);
}

export class ReviewedFieldOverwriteError extends Error {
  readonly reviewedValue: unknown;
  readonly element: ElementId;
  readonly field: FieldName;

  constructor(reviewedValue: unknown, element: ElementId, field: FieldName) {
    super(
      `A value reviewed by a human is not overwritten by an unverified write; '${field}' of '${element.value}' takes the user's acceptance.`,
    );
    this.name = 'ReviewedFieldOverwriteError';
    this.reviewedValue = reviewedValue;
    this.element = element;
    this.field = field;
  }
}
