import type { ProjectConfig } from "../../types.js";
import { writeFile, projectPath } from "../../utils/fs.js";

const lefthookYml = () => `pre-commit:
  commands:
    lint-staged:
      run: npx lint-staged --allow-empty

commit-msg:
  commands:
    validate:
      run: npx commitlint --edit {1}
`;

const commitlintRcJson = () =>
  JSON.stringify(
    {
      extends: ["@commitlint/config-conventional"],
      rules: {
        "type-enum": [
          2,
          "always",
          [
            "feat",
            "fix",
            "docs",
            "style",
            "refactor",
            "perf",
            "test",
            "build",
            "ci",
            "chore",
            "revert",
          ],
        ],
      },
    },
    null,
    2,
  );

export async function generateCommitlint(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const pp = (...s: string[]) => projectPath(root, ...s);
  await writeFile(pp("lefthook.yml"), lefthookYml());
  await writeFile(pp(".commitlintrc.json"), commitlintRcJson());
}
