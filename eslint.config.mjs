import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Ajoutez une configuration personnalisée ici
    rules: {
      // Configuration de la règle @typescript-eslint/no-unused-vars
      "@typescript-eslint/no-unused-vars": [
        "warn", // Ou "error" si vous préférez, mais "warn" est un bon équilibre
        {
          "argsIgnorePattern": "^_",         // Ignore les arguments qui commencent par _
          "varsIgnorePattern": "^_",          // Ignore les variables qui commencent par _
          "caughtErrors": "none"              // <--- C'est la clé ! Ignore les variables de catch non utilisées
        }
      ],
    },
  },
];

export default eslintConfig;