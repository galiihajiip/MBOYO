// @ts-check
import { baseConfig } from "./base.js";
import nextPlugin from "@next/eslint-plugin-next";

/**
 * Next.js ESLint flat config, layered on the shared base config. Uses
 * @next/eslint-plugin-next's flat "core-web-vitals" recommended rules
 * directly rather than bridging the legacy eslint-config-next via
 * FlatCompat, which triggers a circular-structure crash under ESLint 9
 * when resolving nested plugin configs.
 */
export const nextjsConfig = [
  ...baseConfig,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];

export default nextjsConfig;
