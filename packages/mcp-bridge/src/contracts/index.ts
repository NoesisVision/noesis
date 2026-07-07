// Zod contracts for MCP tool payloads — the bridge validates against them and
// generates the reference JSONs shipped by harness plugins (Claude Code,
// Codex, OpenCode, pi, ...) via tools/generate-references.ts.
// DTOs shared with the ui/local contracts live in @repo/shared-contracts.

export * from '@repo/shared-contracts';
export * from './hello.js';
export * from './registry.js';

// Skill-output schemas (the model-facing payloads each skill produces).
export * from './skills/analyzed-topic.js';
