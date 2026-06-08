import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";
import { config as baseConfig } from "./base.js";

/**
 * A shared ESLint configuration for NestJS server apps.
 *
 * Consumers must set `tsconfigRootDir` so typed linting resolves the right
 * tsconfig:
 *
 * ```js
 * import { config } from "@repo/eslint-config/nest";
 * export default [
 *   ...config,
 *   { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
 * ];
 * ```
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  {
    ignores: ["eslint.config.mjs"],
  },
  ...baseConfig,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: "commonjs",
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
];
