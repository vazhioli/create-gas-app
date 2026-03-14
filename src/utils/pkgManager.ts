import { execa } from "execa";
import fs from "fs";
import path from "path";
import type { PackageManager } from "../types.js";

/**
 * Detects the package manager from lockfiles in the current or parent directories,
 * falling back to the npm_config_user_agent env var set by the invoking package manager.
 */
export function detectPackageManager(): PackageManager {
  // Walk up from cwd looking for lockfiles (up to 3 levels)
  let dir = process.cwd();
  for (let i = 0; i < 3; i++) {
    if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bun";
    if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(dir, "package-lock.json"))) return "npm";
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fall back to npm_config_user_agent set by the invoking package manager
  // e.g. `npm create gas-app` sets this to "npm/x.x.x"
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
