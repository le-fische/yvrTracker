import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react"]
        },
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/prop-types": "off",
      "react/no-unknown-property": "off",
      "react/display-name": "off",
      "no-empty": "warn",
      "no-unused-vars": "warn"
    },
  },
  {
    ignores: [".next/", "node_modules/", "tools/"],
  }
];
