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

function validateProjectName(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
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
      { value: "vanilla", label: "Vanilla", hint: "Plain HTML + CSS + TypeScript, no framework" },
    ],
    initialValue: "react",
  })) as Framework;

  if (p.isCancel(framework)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const addonOptions = [
    {
      value: "tailwind",
      label: "Tailwind CSS",
      hint: "v4 with Vite plugin",
    },
    ...(framework === "react"
      ? [
          {
            value: "shadcn",
            label: "shadcn/ui",
            hint: "Component library for React",
          },
        ]
      : []),
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
  ];

  const selectedAddons = (await p.multiselect({
    message: "Select addons (space to toggle, enter to confirm):",
    options: addonOptions,
    required: false,
    initialValues: ["tailwind"],
  })) as Addon[];

  if (p.isCancel(selectedAddons)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // shadcn requires tailwind — auto-add
  const addons = selectedAddons ?? [];
  const hasShadcn = addons.includes("shadcn");
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
    initialValue: detectedPm,
  })) as PackageManager;

  if (p.isCancel(packageManager)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const setupOptions = (await p.multiselect({
    message: "Setup options:",
    options: [
      { value: "installDeps", label: "Install dependencies", hint: `run ${packageManager} install` },
      { value: "initGit", label: "Initialize git repository", hint: "git init + initial commit" },
    ],
    required: false,
    initialValues: ["installDeps", "initGit"],
  })) as string[];

  if (p.isCancel(setupOptions)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  return {
    projectName: (projectName as string).trim(),
    addonType,
    framework,
    addons: finalAddons,
    packageManager,
    installDeps: setupOptions.includes("installDeps"),
    initGit: setupOptions.includes("initGit"),
  };
}
