import { x } from "tinyexec";

export async function isGitInstalled(): Promise<boolean> {
  const result = await x("git", ["--version"]);
  return result.exitCode === 0;
}

export async function isGitUserConfigured(): Promise<boolean> {
  const name = await x("git", ["config", "user.name"]);
  const email = await x("git", ["config", "user.email"]);
  return name.stdout.trim() !== "" && email.stdout.trim() !== "";
}

export async function initGitRepo(cwd: string): Promise<void> {
  await x("git", ["init"], { nodeOptions: { cwd }, throwOnError: true });
  await x("git", ["add", "-A"], { nodeOptions: { cwd }, throwOnError: true });
  await x(
    "git",
    ["commit", "-m", "chore: initial commit from create-gas-app"],
    { nodeOptions: { cwd }, throwOnError: true },
  );
}
