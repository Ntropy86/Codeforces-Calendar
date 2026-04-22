/**
 * ESLint flat config (v9).
 *
 * Keep the ruleset deliberately small. We care about correctness
 * (unused vars, `no-undef`, uncaught promise flags) and stylistic
 * decisions Prettier can't make (prefer-const, no-var). Anything
 * that's purely visual is delegated to Prettier via
 * `eslint-config-prettier` (loaded last so it disables conflicts).
 */

const js = require("@eslint/js");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: ["node_modules/**", "coverage/**", "**/*.min.js"]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["error", "smart"],
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  prettier
];
