module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/dist/**",
    "/node_modules/**",
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": "off",
    "indent": ["error", 2],
    "max-len": ["warn", { code: 120 }],
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "object-curly-spacing": ["error", "always"],
    "new-cap": "off",
    "@typescript-eslint/no-explicit-any": "warn",
  },
};
