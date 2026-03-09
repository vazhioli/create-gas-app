import * as p from "@clack/prompts";
import pc from "picocolors";
import type {
  Addon,
  Framework,
  GasAddonType,
  PackageManager,
  ProjectConfig,
} from "../types.js";
import { detectPackageManager } from "../utils/pkgManager.js";
import { NAME_PATTERN } from "../constants/scaffold.js";

function validateProjectName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Project name is required.";
  if (!NAME_PATTERN.test(trimmed)) {
    return "Only letters, numbers, hyphens, and underscores are allowed.";
  }
}

export async function gatherProjectConfig(
  projectNameArg?: string,
): Promise<ProjectConfig> {
  p.intro(
    pc.bold(pc.cyan(" create-gas-app ")) +
      pc.dim("— Google Apps Script, your way"),
  );

  const projectName = projectNameArg
    ? projectNameArg.trim()
    : ((await p.text({
        message: "What is your project named?",
        placeholder: "my-gas-app",
        validate: validateProjectName,
      })) as string);

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const projectNameError = validateProjectName(projectName as string);
  if (projectNameError) {
    p.cancel(projectNameError);
    process.exit(1);
  }

  const addonType = (await p.select({
    message: "What type of Google Apps Script project?",
    options: [
      {
        value: "sheets",
        label: "Sheets Add-on",
        hint: "Runs inside Google Sheets",
      },
      {
        value: "docs",
        label: "Docs Add-on",
        hint: "Runs inside Google Docs",
      },
      {
        value: "forms",
        label: "Forms Add-on",
        hint: "Runs inside Google Forms",
      },
      {
        value: "standalone",
        label: "Standalone Script",
        hint: "No container, web app or API",
      },
    ],
    initialValue: "sheets",
  })) as GasAddonType;

  if (p.isCancel(addonType)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const framework = (await p.select({
    message: "Which frontend framework?",
    options: [
      { value: "react", label: "React", hint: "TypeScript + SWC" },
      { value: "vue", label: "Vue", hint: "Vue 3 + TypeScript" },
      { value: "svelte", label: "Svelte", hint: "Svelte 5 + TypeScript" },
      { value: "solid", label: "SolidJS", hint: "SolidJS + TypeScript" },
    ],
    initialValue: "react",
  })) as Framework;

  if (p.isCancel(framework)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const selectedAddons = (await p.multiselect({
    message: "Select addons (space to toggle, enter to confirm):",
    options: [
      {
        value: "tailwind",
        label: "Tailwind CSS",
        hint: "v4 with Vite plugin",
      },
      {
        value: "shadcn",
        label: "shadcn/ui",
        hint: `Component library — ${framework === "react" ? "full support" : "React only, skip or switch framework"}`,
      },
      {
        value: "commitlint",
        label: "Commitlint + Lefthook",
        hint: "Conventional commits + git hooks",
      },
      {
        value: "eslint",
        label: "ESLint",
        hint: "Flat config with TypeScript + framework rules",
      },
    ],
    required: false,
    initialValues: ["tailwind"],
  })) as Addon[];

  if (p.isCancel(selectedAddons)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Warn if shadcn is selected with non-React framework
  const addons = selectedAddons ?? [];
  if (addons.includes("shadcn") && framework !== "react") {
    p.note(
      `shadcn/ui will be ${pc.yellow("skipped")} — it currently only supports React.\nYou can add it later by switching to React.`,
      "Note",
    );
  }

  // shadcn requires tailwind — auto-add
  const hasShadcn = addons.includes("shadcn") && framework === "react";
  const finalAddons: Addon[] = [...addons.filter((a) => a !== "shadcn")];
  if (hasShadcn) {
    if (!finalAddons.includes("tailwind")) finalAddons.push("tailwind");
    finalAddons.push("shadcn");
  }

  const detectedPm = detectPackageManager();
  const packageManager = (await p.select({
    message: "Which package manager?",
    options: [
      { value: "bun", label: "bun", hint: detectedPm === "bun" ? "detected" : "" },
      { value: "pnpm", label: "pnpm", hint: detectedPm === "pnpm" ? "detected" : "" },
      { value: "npm", label: "npm", hint: detectedPm === "npm" ? "detected" : "" },
      { value: "yarn", label: "yarn", hint: detectedPm === "yarn" ? "detected" : "" },
    ],
    initialValue: "bun",
  })) as PackageManager;

  if (p.isCancel(packageManager)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const installDeps = (await p.confirm({
    message: "Install dependencies now?",
    initialValue: true,
  })) as boolean;

  if (p.isCancel(installDeps)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const initGit = (await p.confirm({
    message: "Initialize a git repository?",
    initialValue: true,
  })) as boolean;

  if (p.isCancel(initGit)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  return {
    projectName: (projectName as string).trim(),
    addonType,
    framework,
    addons: finalAddons,
    packageManager,
    installDeps: installDeps as boolean,
    initGit: initGit as boolean,
  };
}
