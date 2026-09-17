// The knowledge graph file contracts: every shape a file under `.noesis/` can
// have, plus the payloads the import tools take. Defined once as zod schemas,
// read by the agent as source (the plugin ships a copy), validated by the
// service on every write.
//
// Declarative on purpose (decision 68): object shapes, enums and `.describe()`
// text, no refinements, no transforms, no imports beyond zod and sibling
// contract files. Whole-document rules the schemas cannot express live with
// the service that enforces them; conventions with no type live in the
// companion `.md` beside each family.

export * from './change.js';
export * from './decision.js';
export * from './design-doc.js';
export * from './design-doc-ref.js';
export * from './information-sources/conversation.js';
export * from './information-sources/conversation-analysis.js';
export * from './information-sources/document.js';
export * from './information-sources/document-analysis.js';
export * from './information-sources/information-category.js';
export * from './information-sources/information-fragment.js';
export * from './locked.js';
export * from './system-model.js';
export * from './topic.js';
