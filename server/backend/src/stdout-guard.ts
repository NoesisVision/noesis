// stdout carries the MCP protocol: a dependency's console.log would corrupt it.
// Imports are hoisted, so the redirect lives in a module of its own and
// main.ts imports it first — an assignment in main.ts would run only after
// every other module had been evaluated, import-time logging included.
console.log = (...args: unknown[]) => console.error(...args);
