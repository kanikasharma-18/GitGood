const { builtinRules } = require("eslint/use-at-your-own-risk");

const recommendedRules = Object.fromEntries(
  [...builtinRules]
    .filter(([, rule]) => rule.meta.docs.recommended)
    .map(([name]) => [name, "error"])
);

const nodeGlobals = {
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  console: "readonly",
  exports: "readonly",
  global: "readonly",
  module: "readonly",
  process: "readonly",
  require: "readonly",
  setImmediate: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  clearImmediate: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
};

module.exports = [
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "dist/",
      "build/",
      "*.min.js",
      "*.generated.js",
    ],
  },
  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules: recommendedRules,
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
];
