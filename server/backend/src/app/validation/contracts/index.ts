// The file-contract registry: each declarative schema from the features'
// `model/` folders paired with the whole-document check the service runs on
// write. The agent reads the same schemas as source from the plugin's
// `contracts/` copy.

export * from './design-document';
export * from './registry';
