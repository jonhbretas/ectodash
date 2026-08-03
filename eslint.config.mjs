import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextParser from "eslint-config-next/parser";
import globals from "globals";

// NOTE: `eslint-config-next` (and its `/core-web-vitals` and `/typescript`
// sub-exports) cannot be imported as of typescript@7.0.2 — its shared
// bootstrap module unconditionally `require("typescript-eslint")` at load
// time, and typescript-eslint@8.65.0 hard-throws on TS >=7.0 with:
//   "typescript-eslint does not support TS 7.0."
// Tracked upstream: https://github.com/typescript-eslint/typescript-eslint/issues/10940
// Until that ships, this file reproduces eslint-config-next's non-TS-aware
// "next" rule block directly from its constituent plugins (react,
// react-hooks, @next/eslint-plugin-next, import, jsx-a11y) so `npm run lint`
// stays usable while TypeScript 7.0.2 (the researched/pinned version) type
// safety is enforced separately via `npx tsc --noEmit`. Re-adopt
// `eslint-config-next/typescript` once typescript-eslint supports TS 7.x.
const eslintConfig = defineConfig([
  {
    name: "next",
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      import: importPlugin,
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parser: nextParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: "module",
        allowImportExportEverywhere: true,
        babelOptions: {
          presets: ["next/babel"],
          caller: { supportsTopLevelAwait: true },
        },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: "detect" },
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".mts", ".cts", ".tsx", ".d.ts"],
      },
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-no-target-blank": "off",
    },
  },
  jsxA11y.flatConfigs.recommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
