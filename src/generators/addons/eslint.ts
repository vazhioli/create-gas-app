import type { Framework, ProjectConfig } from "../../types.js";
import { writeFile, projectPath } from "../../utils/fs.js";

const eslintConfigJs = (framework: Framework): string => {
  switch (framework) {
    case "react":
      return `import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true, allowExportNames: ["buttonVariants"] }],
    },
  },
);
`;

    case "vue":
      return `import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...pluginVue.configs["flat/recommended"],
    ],
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
);
`;

    case "svelte":
      return `import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...svelte.configs["flat/recommended"],
    ],
    files: ["**/*.{ts,svelte}"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
);
`;

    case "solid":
      return `import js from "@eslint/js";
import tseslint from "typescript-eslint";
import solid from "eslint-plugin-solid";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    plugins: { solid },
    rules: { ...solid.configs.recommended.rules },
  },
);
`;

    case "vanilla":
      return `import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts"],
  },
);
`;
  }
};

export async function generateEslint(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  await writeFile(projectPath(root, "eslint.config.js"), eslintConfigJs(config.framework));
}
