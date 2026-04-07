module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        exports: "readonly",
        module: "readonly",
        console: "readonly",
      },
    },
    rules: {},
  },
];
