// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
// DTOs common to the ui, local, and mcp contract packages.
// Defined as zod schemas (single source of truth); consumers that only need
// types should use type-only imports so zod stays out of their runtime.

// Primitives & helpers.
// `uuid.ts` is intentionally NOT re-exported here: it uses Bun/node runtime
// APIs, and this barrel is consumed by the browser-facing ui-contracts. Import
// it via the subpath instead — `@repo/shared-contracts/uuid`.
export * from './assert-never.js';
export * from './decision.js';
export * from './design-doc.js';
// Placeholder transport DTO from the hello flow.
export * from './hello.js';
export * from './information-sources/conversation.js';
export * from './information-sources/document.js';
// Core domain model (the ubiquitous language, used by services, UI DTOs, and
// skill-output schemas alike). Per OQ-1.1 these live in shared-contracts.
export * from './information-sources/information-category.js';
export * from './information-sources/information-fragment.js';
export * from './project.js';
export * from './topic.js';
