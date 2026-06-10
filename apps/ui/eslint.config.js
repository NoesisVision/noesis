import { config } from "@repo/eslint-config/vite-react";

export default [
  // React Flow Pro example projects — vendored reference material, not ours to lint.
  { ignores: ["docs/react-flow-examples/**"] },
  ...config,
];
