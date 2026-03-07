import { execa } from "execa";
import type { PackageManager } from "../types.js";

/**
 * Detects which package manager was used to invoke the CLI.
 * `npm create gas-app` sets npm_config_user_agent to "npm/x.x.x"
 */
export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("pnpm")) return "pnpm";
  if (userAgent.startsWith("yarn")) return "yarn";
  if (userAgent.startsWith("bun")) return "bun";
  return "npm";
}

export function getInstallCommand(pm: PackageManager): string[] {
  switch (pm) {
    case "bun":
      return ["bun", "install"];
    case "pnpm":
      return ["pnpm", "install"];
    case "yarn":
      return ["yarn"];
    case "npm":
      return ["npm", "install"];
  }
}

export function getRunCommand(pm: PackageManager, script: string): string {
  switch (pm) {
    case "bun":
      return `bun run ${script}`;
    case "pnpm":
      return `pnpm run ${script}`;
    case "yarn":
      return `yarn ${script}`;
    case "npm":
      return `npm run ${script}`;
  }
}

export async function installDependencies(
  cwd: string,
  pm: PackageManager,
): Promise<void> {
  const [cmd, ...args] = getInstallCommand(pm);
  await execa(cmd, args, { cwd, stdio: "pipe" });
}
