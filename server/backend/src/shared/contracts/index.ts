// The knowledge graph file contracts: every shape a file under `.noesis/` can
// have, plus the payloads the import tools take. Defined once as zod schemas,
// read by the agent as source (the plugin ships a copy), validated by the
// service on every write.
//
// Declarative on purpose (decision D4): object shapes, enums and `.describe()`
// text, no refinements, no transforms, no imports beyond zod and sibling
// contract files. Whole-document rules the schemas cannot express live with
// the service that enforces them; conventions with no type live in the
// companion `.md` beside each family.

export * from './change';
export * from './decision';
export * from './design-doc';
export * from './design-doc-ref';
export * from './information-sources/conversation';
export * from './information-sources/conversation-analysis';
export * from './information-sources/document';
export * from './information-sources/document-analysis';
export * from './information-sources/information-category';
export * from './information-sources/information-fragment';
export * from './locked';
export * from './system-model';
export * from './topic';
