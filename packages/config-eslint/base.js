// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/** Shared base ESLint flat config for all MBOYO TypeScript packages/apps. */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Config files themselves aren't part of any tsconfig "include" and
    // shouldn't be type-checked — lint them with plain (non type-aware)
    // rules only.
    files: ["*.config.js", "*.config.ts", "*.config.mjs", "*.config.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/.sw-build/**",
      "**/public/sw.js",
    ],
  },
  eslintConfigPrettier,
);

export default baseConfig;
