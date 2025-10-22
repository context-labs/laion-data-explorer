/** @type {import("prettier").Config} */
module.exports = {
  semi: true,
  trailingComma: "all",
  singleQuote: false,
  printWidth: 80,
  tabWidth: 2,
  endOfLine: "auto",
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  embeddedLanguageFormatting: "off",
  importOrderParserPlugins: ["typescript", "jsx"],
};
