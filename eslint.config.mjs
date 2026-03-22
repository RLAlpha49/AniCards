import { defineConfig, globalIgnores } from "eslint/config";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  // Explicit React version avoids calling plugin detection which can break under ESLint 10.
  // Keeps ESLint 10 while preventing `contextOrFilename.getFilename` errors in
  // eslint-plugin-react's version detection code.
  {
    settings: {
      react: {
        version: "19.2.4",
        defaultVersion: "19.2.4",
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    extends: [eslintPluginBetterTailwindcss.configs["recommended"]],
    settings: {
      "better-tailwindcss": {
        entryPoint: "app/globals.css",
      },
    },
    rules: {
      "better-tailwindcss/enforce-consistent-line-wrapping": [
        "warn",
        {
          printWidth: 100,
          preferSingleLine: true,
          indent: 2,
          lineBreakStyle: "windows",
        },
      ],
    },
  },
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    rules: {
      "@next/next/no-img-element": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/image",
              message: "Use the native <img> element instead of next/image.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
