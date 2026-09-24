// Facts about, and guards on, the process itself. main.ts imports this module
// first: imports are hoisted, so an assignment in main.ts would run only after
// every other module had been evaluated, import-time logging included.

// stdout carries the MCP protocol: a dependency's console.log would corrupt it.
console.log = (...args: unknown[]) => console.error(...args);

/**
 * Whether this is the built bin. `bun build --production` runs with
 * `NODE_ENV=production` and inlines this expression as `true`, so the bundle
 * knows what it is whatever environment later launches it. From source it is
 * `false` unless the shell says otherwise.
 */
export const production = process.env.NODE_ENV === 'production';
