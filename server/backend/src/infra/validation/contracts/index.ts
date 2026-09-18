// The contracts as the service uses them: the declarative schemas from
// @repo/shared-contracts, and the file-contract registry that pairs a schema
// with the whole-document check the service runs on write. The agent reads
// the same schemas as source from the plugin's `contracts/` copy.

export * from '@repo/shared-contracts';
export * from './design-document.js';
export * from './registry.js';
