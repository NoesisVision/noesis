/** The working file, as both design-document tools describe it. */
export const DESIGN_DOC_SHAPE =
  '{ "name", "description", "modules", "buildingBlocks", "behaviours" }. A field is { "value", "author" } when the design changes it, { "changed": false } or absent when it does not; each collection is a change set of { "added", "removed", "modified" }. Write every field as the agent: leave "author" out. A design modifies or removes only what the newest scan has, by its id; before the first scan it only adds, at every level.';
