import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import fs from "fs";
import { gatherProjectConfig } from "./prompts/index.js";
import { scaffoldProject } from "./generators/index.js";
import type { Addon, Framework, GasAddonType, PackageManager, ProjectConfig } from "./types.js";
import { ADDON_DEPS, ESLINT_FRAMEWORK_DEPS, IMPORT_MAPS } from "./constants/scaffold.js";

const NAME_PATTERN = /^[a-z0-9_-]+$/i;

function validateName(value: string, label: string): void {
  if (!NAME_PATTERN.test(value)) {
    console.error(
      pc.red(
        `Invalid ${label}: "${value}". Only letters, numbers, hyphens, and underscores are allowed.`,
      ),
    );
    process.exit(1);
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function run(argv: string[]): Promise<void> {
  const projectNameArg =
    argv[0] && !argv[0].startsWith("-") ? argv[0] : undefined;

  if (argv.includes("--version") || argv.includes("-v")) {
    const pkgPath = new URL("../package.json", import.meta.url);
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      console.log(pkg.version);
    } catch {
      console.log("unknown");
    }
    process.exit(0);
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (argv[0] === "add") {
    await runAdd(argv.slice(1));
    return;
  }

  console.log();

  const config = await gatherProjectConfig(projectNameArg);
  const root = path.resolve(process.cwd(), config.projectName);
  validateName(config.projectName, "project name");
  if (!isInside(process.cwd(), root)) {
    console.error(
      pc.red(`Refusing to scaffold outside current directory: ${root}`),
    );
    process.exit(1);
  }

  if (fs.existsSync(root)) {
    const files = fs.readdirSync(root);
    if (files.length > 0) {
      const overwrite = await p.confirm({
        message: `${pc.yellow(config.projectName)} already exists and is not empty. Overwrite?`,
        initialValue: false,
      });
      if (!overwrite || p.isCancel(overwrite)) {
        p.cancel("Aborted.");
        process.exit(1);
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  await scaffoldProject(root, config);
}

// ─── `create-gas-app add` subcommand ─────────────────────────────────────────

async function runAdd(argv: string[]): Promise<void> {
  const subcommand = argv[0];
  if (subcommand === "dialog") {
    const name = argv[1];
    if (!name) {
      console.error(
        pc.red(
          "Usage: create-gas-app add dialog <name>\n  e.g. create-gas-app add dialog settings",
        ),
      );
      process.exit(1);
    }
    await addDialog(name);
    return;
  }
  if (subcommand === "addon") {
    await runAddAddon(argv.slice(1));
    return;
  }
  console.error(
    pc.red(
      `Unknown subcommand: ${subcommand}\n\nAvailable:\n  add dialog <name>\n  add addon <name>`,
    ),
  );
  process.exit(1);
}

async function runAddAddon(argv: string[]): Promise<void> {
  const name = argv[0];
  if (!name) {
    console.error(pc.red("Usage: create-gas-app add addon <name>\n  Available: tailwind, eslint, commitlint, shadcn"));
    process.exit(1);
  }
  await addAddon(name);
}

async function addDialog(name: string): Promise<void> {
  const { writeFile } = await import("./utils/fs.js");
  const root = process.cwd();
  const dialogName = name.trim();
  validateName(dialogName, "dialog name");

  // Detect project name and framework from root package.json
  let projectName = "my-gas-app";
  let framework: Framework = "react";
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf-8"),
    );
    if (pkg.name) projectName = pkg.name;
    if (pkg.dependencies?.vue) framework = "vue";
    else if (pkg.dependencies?.svelte) framework = "svelte";
    else if (pkg.dependencies?.["solid-js"]) framework = "solid";
  } catch {
    // defaults
  }

  const appRoot = path.resolve(root, "apps", projectName);
  if (!isInside(root, appRoot)) {
    console.error(
      pc.red(
        "Invalid project layout: apps root resolves outside current directory.",
      ),
    );
    process.exit(1);
  }
  if (!fs.existsSync(appRoot)) {
    console.error(
      pc.red(
        `Cannot find apps root: apps/${projectName}/. Run this command from a generated project root.`,
      ),
    );
    process.exit(1);
  }

  const dialogsRoot = path.resolve(appRoot, "dialogs");
  fs.mkdirSync(dialogsRoot, { recursive: true });

  // New dialog lives at apps/<projectName>/dialogs/<dialogName>/
  const appDir = path.resolve(dialogsRoot, dialogName);
  if (!isInside(dialogsRoot, appDir)) {
    console.error(pc.red(`Invalid dialog name: "${dialogName}"`));
    process.exit(1);
  }
  if (fs.existsSync(appDir)) {
    console.error(
      pc.red(
        `"${dialogName}" already exists at apps/${projectName}/dialogs/${dialogName}/`,
      ),
    );
    process.exit(1);
  }

  const mainExt = framework === "vue" || framework === "svelte" ? "ts" : "tsx";
  const appExt =
    framework === "vue" ? "vue" : framework === "svelte" ? "svelte" : mainExt;
  const pascal = dialogName.charAt(0).toUpperCase() + dialogName.slice(1);
  const importMap = JSON.stringify(
    { imports: IMPORT_MAPS[framework] },
    null,
    2,
  );

  // index.html
  await writeFile(
    path.join(appDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${dialogName}</title>
    <script type="importmap">
${importMap}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.${mainExt}"></script>
  </body>
</html>
`,
  );

  // main entry
  if (framework === "react") {
    await writeFile(
      path.join(appDir, "src", `main.${mainExt}`),
      `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport { App } from "./App";\nimport "@${projectName}/shared/styles/global.css";\n\ncreateRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);\n`,
    );
    await writeFile(
      path.join(appDir, "src", `App.${appExt}`),
      `export function App() {\n  return <div style={{ padding: "24px" }}><h1>${pascal}</h1></div>;\n}\n`,
    );
  } else if (framework === "vue") {
    await writeFile(
      path.join(appDir, "src", `main.${mainExt}`),
      `import { createApp } from "vue";\nimport App from "./App.vue";\nimport "@${projectName}/shared/styles/global.css";\ncreateApp(App).mount("#root");\n`,
    );
    await writeFile(
      path.join(appDir, "src", `App.${appExt}`),
      `<template>\n  <div style="padding: 24px"><h1>${pascal}</h1></div>\n</template>\n`,
    );
  } else if (framework === "svelte") {
    await writeFile(
      path.join(appDir, "src", `main.${mainExt}`),
      `import { mount } from "svelte";\nimport App from "./App.svelte";\nimport "@${projectName}/shared/styles/global.css";\nmount(App, { target: document.getElementById("root")! });\n`,
    );
    await writeFile(
      path.join(appDir, "src", `App.${appExt}`),
      `<div style="padding: 24px"><h1>${pascal}</h1></div>\n`,
    );
  } else {
    await writeFile(
      path.join(appDir, "src", `main.${mainExt}`),
      `import { render } from "solid-js/web";\nimport { App } from "./App";\nimport "@${projectName}/shared/styles/global.css";\nrender(() => <App />, document.getElementById("root")!);\n`,
    );
    await writeFile(
      path.join(appDir, "src", `App.${appExt}`),
      `export function App() {\n  return <div style={{ padding: "24px" }}><h1>${pascal}</h1></div>;\n}\n`,
    );
  }

  p.log.success(
    `Dialog ${pc.cyan(dialogName)} created at ${pc.dim(`apps/${projectName}/dialogs/${dialogName}/`)}`,
  );
  p.note(
    [
      `Register it in ${pc.cyan("vite.config.ts")} entrypoints:`,
      "",
      `  { name: "${pascal}", filename: "${dialogName}", appDir: "${dialogName}", template: "index.html" }`,
      "",
      `Add an opener in ${pc.cyan("packages/server/src/ui.ts")}:`,
      "",
      `  export const open${pascal}Dialog = () => {`,
      `    const html = HtmlService.createHtmlOutputFromFile("${dialogName}")`,
      `      .setWidth(800)`,
      `      .setHeight(500);`,
      `    SpreadsheetApp.getUi().showModalDialog(`,
      `      html, "${pascal}",`,
      `    );`,
      `  };`,
      "",
      `Then export it from ${pc.cyan("packages/server/src/index.ts")}.`,
    ].join("\n"),
    "Next steps",
  );
}

// ─── `create-gas-app add addon` helper functions ──────────────────────────────

function detectLockfilePm(root: string): PackageManager {
  if (fs.existsSync(path.join(root, "bun.lock"))) return "bun";
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  return "npm";
}

interface PkgJsonUpdate {
  devDeps?: Record<string, string>;
  deps?: Record<string, string>;
  scripts?: Record<string, string>;
  extra?: Record<string, unknown>;
}

async function updatePackageJson(root: string, update: PkgJsonUpdate): Promise<void> {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  if (update.devDeps) {
    pkg.devDependencies = { ...(pkg.devDependencies ?? {}), ...update.devDeps };
  }
  if (update.deps) {
    pkg.dependencies = { ...(pkg.dependencies ?? {}), ...update.deps };
  }
  if (update.scripts) {
    pkg.scripts = { ...(pkg.scripts ?? {}), ...update.scripts };
  }
  if (update.extra) {
    Object.assign(pkg, update.extra);
  }
  const { writeJsonFile } = await import("./utils/fs.js");
  await writeJsonFile(pkgPath, pkg);
}

async function addAddon(addonName: string): Promise<void> {
  const supported = ["tailwind", "eslint", "commitlint", "shadcn"];
  if (!supported.includes(addonName)) {
    console.error(pc.red(`Unknown addon: ${addonName}\n  Available: ${supported.join(", ")}`));
    process.exit(1);
  }

  const root = process.cwd();

  // Auto-detect project from cwd
  let projectName = "my-gas-app";
  let framework: Framework = "react";
  let addonType: GasAddonType = "sheets";
  let detectedPm: PackageManager = detectLockfilePm(root);

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
    if (pkg.name) projectName = pkg.name;
    if (pkg.dependencies?.vue) framework = "vue";
    else if (pkg.dependencies?.svelte) framework = "svelte";
    else if (pkg.dependencies?.["solid-js"]) framework = "solid";
    // Detect addonType from clasp:create script
    const claspCreate: string = pkg.scripts?.["clasp:create"] ?? "";
    if (claspCreate.includes("--type docs")) addonType = "docs";
    else if (claspCreate.includes("--type forms")) addonType = "forms";
    else if (claspCreate.includes("--type standalone")) addonType = "standalone";
    else addonType = "sheets";
  } catch {
    // defaults
  }

  const appRoot = path.resolve(root, "apps", projectName);
  if (!fs.existsSync(appRoot)) {
    console.error(pc.red(`Cannot find apps root: apps/${projectName}/. Run this command from a generated project root.`));
    process.exit(1);
  }

  // Read existing devDeps for duplicate checking
  let existingDevDeps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
    existingDevDeps = pkg.devDependencies ?? {};
  } catch {
    // ignore
  }

  const config: ProjectConfig = {
    projectName,
    framework,
    addonType,
    addons: [addonName as Addon],
    packageManager: detectedPm,
    installDeps: false,
    initGit: false,
  };

  const pm = detectedPm;

  if (addonName === "tailwind") {
    if (existingDevDeps["tailwindcss"]) {
      console.warn(pc.yellow("tailwindcss is already installed in devDependencies."));
      process.exit(0);
    }
    const { generateTailwind } = await import("./generators/addons/tailwind.js");
    await generateTailwind(root, config);
    await updatePackageJson(root, {
      devDeps: {
        tailwindcss: "^4.1.18",
        "@tailwindcss/vite": "^4.1.18",
        "tw-animate-css": "^1.4.0",
      },
    });
    p.note(
      [
        `Update ${pc.cyan("vite.config.ts")} — add the Tailwind plugin:`,
        "",
        `  import tailwindcss from "@tailwindcss/vite";`,
        "",
        `  // In serve config plugins:`,
        `  tailwindcss(),`,
        "",
        `  // In build config plugins:`,
        `  tailwindcss(),`,
        "",
        `Then run ${pc.cyan(`${pm} install`)}`,
      ].join("\n"),
      "Next steps",
    );
  } else if (addonName === "eslint") {
    if (existingDevDeps["eslint"]) {
      console.warn(pc.yellow("eslint is already installed in devDependencies."));
      process.exit(0);
    }
    const { generateEslint } = await import("./generators/addons/eslint.js");
    await generateEslint(root, config);
    await updatePackageJson(root, {
      devDeps: {
        ...ADDON_DEPS.eslint.dev,
        ...ESLINT_FRAMEWORK_DEPS[framework],
      },
      scripts: {
        lint: "eslint .",
        "lint:fix": "eslint . --fix",
      },
    });
    p.log.success(`Run ${pc.cyan(`${pm} install`)} to finish setup.`);
  } else if (addonName === "commitlint") {
    if (existingDevDeps["@commitlint/cli"]) {
      console.warn(pc.yellow("commitlint is already installed in devDependencies."));
      process.exit(0);
    }
    const { generateCommitlint } = await import("./generators/addons/commitlint.js");
    await generateCommitlint(root, config);
    await updatePackageJson(root, {
      devDeps: { ...ADDON_DEPS.commitlint.dev },
      extra: { "lint-staged": { "*": "prettier --write --ignore-unknown" } },
    });
    p.log.success(`Run ${pc.cyan(`${pm} install && npx lefthook install`)} to finish setup.`);
  } else if (addonName === "shadcn") {
    if (framework !== "react") {
      console.error(pc.red("shadcn/ui only supports React. Switch to React first."));
      process.exit(1);
    }
    if (!existingDevDeps["tailwindcss"]) {
      console.error(pc.red("Tailwind CSS is required. Run `create-gas-app add addon tailwind` first."));
      process.exit(1);
    }
    const { generateShadcn } = await import("./generators/addons/shadcn.js");
    const { generateTailwind } = await import("./generators/addons/tailwind.js");
    await generateShadcn(root, config);
    await generateTailwind(root, config);
    await updatePackageJson(root, {
      devDeps: { ...ADDON_DEPS.shadcn.dev },
      deps: { ...ADDON_DEPS.shadcn.prod },
    });
    p.log.success(`Run ${pc.cyan(`${pm} install`)} to finish setup.`);
  }
}

function printHelp(): void {
  console.log(`
${pc.bold(pc.cyan("create-gas-app"))} — Scaffold a Google Apps Script app

${pc.bold("Usage:")}
  npx create-gas-app [project-name] [options]
  npx create-gas-app add dialog <name>
  npx create-gas-app add addon <name>

${pc.bold("Options:")}
  -h, --help      Show this help message
  -v, --version   Show version number

${pc.bold("Subcommands:")}
  add dialog <name>    Add a new dialog/sidebar app to an existing project
  add addon <name>     Add an addon to an existing project (tailwind, eslint, commitlint, shadcn)

${pc.bold("Examples:")}
  npx create-gas-app
  npx create-gas-app my-sheets-addon
  npx create-gas-app add dialog settings

${pc.bold("Frameworks:")}
  React (TypeScript + SWC) · Vue 3 · Svelte 5 · SolidJS

${pc.bold("Addons:")}
  Tailwind CSS v4 · shadcn/ui · Commitlint + Lefthook
`);
}
