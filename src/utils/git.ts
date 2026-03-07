import { execa } from "execa";

export async function isGitInstalled(): Promise<boolean> {
  try {
    await execa("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function initGitRepo(cwd: string): Promise<void> {
  await execa("git", ["init"], { cwd });
  await execa("git", ["add", "-A"], { cwd });
  await execa(
    "git",
    ["commit", "-m", "chore: initial commit from create-gas-app"],
    { cwd },
  );
}
