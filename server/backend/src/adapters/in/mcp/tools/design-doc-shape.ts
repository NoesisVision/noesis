/** The working file, as both design-document tools describe it. */
export const DESIGN_DOC_SHAPE =
  '{ "name", "description", "modules", "buildingBlocks", "behaviours" }. A field is { "value", "author" } when the design changes it, { "changed": false } or absent when it does not; each collection is a change set of { "added", "removed", "modified" }. Write every field as the agent: leave "author" out. Nothing is scanned yet, so a design only adds, at every level.';
