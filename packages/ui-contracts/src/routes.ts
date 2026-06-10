// REST routes the ui app calls on the server. Controllers and the ui client
// import these constants, so the two sides cannot drift. Endpoints under the
// `ui` prefix will carry ui-session auth (separate from the `api` surface).
export const uiRoutes = {
  prefix: 'ui',
  hello: 'hello',
} as const;

/** Full path (no leading slash) of a ui endpoint, e.g. `ui/hello`. */
export function uiPath(
  route: Exclude<keyof typeof uiRoutes, 'prefix'>,
): string {
  return `${uiRoutes.prefix}/${uiRoutes[route]}`;
}
