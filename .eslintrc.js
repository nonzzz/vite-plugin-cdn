module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  extends: ["plugin:@typescript-eslint/recommended", "kagura", "prettier"],
  ignorePatterns: ["dist/**/*"],
};
