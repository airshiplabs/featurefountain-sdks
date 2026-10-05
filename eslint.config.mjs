import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["scripts/**"], languageOptions: { globals: globals.node } },
  globalIgnores([
    "dist/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
