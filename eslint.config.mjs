import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Codigo de producao nao pode importar o harness de teste
    // (`tests/harness/whatsapp/`) nem os CLIs de `scripts/`. Tree-shaking
    // impede o codigo de ir pro bundle, mas nao impede alguem de importar o
    // repositorio em memoria numa rota — e ai o import compila e faz deploy.
    files: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/tests/**", "@/tests/*", "@/tests/**", "**/scripts/**", "@/scripts/*"],
              message:
                "Codigo de producao nao pode importar harness de teste nem scripts. Ver tests/harness/whatsapp/index.ts.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
