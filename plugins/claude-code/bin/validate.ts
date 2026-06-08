// Validates a JSON file against a named contract using the zod schemas in
// contracts/ (copied from @repo/mcp-contracts by `bun run generate`).
// Usage: bun bin/validate.ts <contract-name> <path/to/payload.json>
import { readFile } from 'node:fs/promises';
import { contracts, type ContractName } from '../contracts';

const [name, file] = process.argv.slice(2);
if (!name || !file) {
  console.error('Usage: bun bin/validate.ts <contract-name> <payload.json>');
  console.error(`Contracts: ${Object.keys(contracts).join(', ')}`);
  process.exit(2);
}
if (!(name in contracts)) {
  console.error(
    `Unknown contract "${name}". Contracts: ${Object.keys(contracts).join(', ')}`,
  );
  process.exit(2);
}

const payload = JSON.parse(await readFile(file, 'utf8'));
const result = contracts[name as ContractName].schema.safeParse(payload);

if (result.success) {
  console.log(`OK — ${file} is a valid ${name}`);
} else {
  console.error(`INVALID — ${file} does not match ${name}:`);
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}
