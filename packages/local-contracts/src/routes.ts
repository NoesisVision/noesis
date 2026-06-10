// REST routes the local app (MCP server) calls on the server. Controllers and
// ServerClientService import these constants, so the two sides cannot drift.
// Endpoints under the `api` prefix will carry token auth (separate from the
// `ui` surface).
export const apiRoutes = {
  prefix: 'api',
  hello: 'hello',
} as const;

/** Full path (no leading slash) of an api endpoint, e.g. `api/hello`. */
export function apiPath(
  route: Exclude<keyof typeof apiRoutes, 'prefix'>,
): string {
  return `${apiRoutes.prefix}/${apiRoutes[route]}`;
}
