import * as p from "@clack/prompts";
import { x } from "tinyexec";
import pc from "picocolors";
import path from "path";
import type { ProjectConfig } from "../types.js";
import { installDependencies } from "../utils/pkgManager.js";
import { initGitRepo, isGitInstalled } from "../utils/git.js";
import { generateBase } from "./base.js";
import { generateServer } from "./server.js";
import { generateClient } from "./client.js";
import { generateViteConfig } from "./vite.js";
import { generatePackageJson } from "./pkg.js";
import { generateTailwind } from "./addons/tailwind.js";
import { generateShadcn } from "./addons/shadcn.js";
import { generateCommitlint } from "./addons/commitlint.js";
import { generateEslint } from "./addons/eslint.js";
import { generateReadme } from "./readme.js";

export async function scaffoldProject(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const rel = path.relative(process.cwd(), root) || ".";
  const spinner = p.spinner();

  // ── 1. Generate all files ─────────────────────────────────────────────────

  spinner.start("Scaffolding project files...");
  try {
    await generateBase(root, config);
    await generateServer(root, config);
    await generateClient(root, config);
    await generateViteConfig(root, config);
    await generatePackageJson(root, config);

    const hasTailwind =
      config.addons.includes("tailwind") || config.addons.includes("shadcn");
    if (hasTailwind) await generateTailwind(root, config);
    if (config.addons.includes("shadcn")) await generateShadcn(root, config);
    if (config.addons.includes("commitlint"))
      await generateCommitlint(root, config);
    if (config.addons.includes("eslint")) await generateEslint(root, config);
    await generateReadme(root, config);

    spinner.stop("Project files created.");
  } catch (err) {
    spinner.error("Failed to scaffold project files.");
    throw err;
  }

  // ── 2. Install dependencies ───────────────────────────────────────────────

  let depsInstalled = false;
  if (config.installDeps) {
    spinner.start(
      `Installing dependencies with ${pc.cyan(config.packageManager)}...`,
    );
    try {
      await installDependencies(root, config.packageManager);
      depsInstalled = true;
      spinner.stop("Dependencies installed.");
    } catch {
      spinner.error("Dependency install failed — run it manually.");
    }
  }

  // ── 3. Format generated files (only when deps are installed) ──────────────

  if (depsInstalled) {
    spinner.start("Formatting generated files...");
    try {
      const formatArgs =
        config.packageManager === "yarn" ? ["format"] : ["run", "format"];
      await x(config.packageManager, formatArgs, { nodeOptions: { cwd: root }, throwOnError: true });
      spinner.stop("Formatting complete.");
    } catch {
      spinner.error("Formatting failed — run it manually.");
    }
  }

  // ── 4. Lefthook (if commitlint selected and deps installed) ───────────────

  if (config.addons.includes("commitlint") && depsInstalled) {
    try {
      await x("npx", ["lefthook", "install"], { nodeOptions: { cwd: root }, throwOnError: true });
    } catch {
      // non-fatal
    }
  }

  // ── 5. Git init ───────────────────────────────────────────────────────────

  if (config.initGit) {
    if (await isGitInstalled()) {
      spinner.start("Initialising git repository...");
      try {
        await initGitRepo(root);
        spinner.stop("Git repository initialised.");
      } catch {
        spinner.error("Git init failed — run it manually.");
      }
    } else {
      p.note("git is not installed. Skipping.", pc.yellow("Warning"));
    }
  }

  // ── 6. Done ───────────────────────────────────────────────────────────────

  const pm = config.packageManager;
  const run = `${pm} run`;
  const stepOffset = rel !== "." ? 1 : 0;
  const appOpenHint =
    config.addonType === "standalone"
      ? "# Open Apps Script project in browser"
      : "# Open spreadsheet/doc/forms container and launch the add-on";
  const openCommand =
    config.addonType === "standalone"
      ? `${run} clasp:open:script`
      : `${run} clasp:open:container`;

  const gasTypeLabel: Record<string, string> = {
    sheets: "Sheets add-on",
    docs: "Docs add-on",
    forms: "Forms add-on",
    standalone: "Standalone web app",
  };

  p.note(
    [
      `Project created at ${pc.cyan(rel + "/")}`,
      "",
      pc.bold("Next steps:"),
      "",
      ...(rel !== "." ? [`  1. ${pc.cyan(`cd ${rel}`)}`] : []),
      `  ${1 + stepOffset}. ${pc.dim("# Authenticate with Google:")}`,
      `     ${pc.cyan(`${run} clasp:login`)}`,
      "",
      `  ${2 + stepOffset}. ${pc.dim(`# Create and link your GAS project (pre-configured as ${gasTypeLabel[config.addonType]}):`)}`,
      `     ${pc.cyan(`${run} clasp:create`)}`,
      "",
      `  ${3 + stepOffset}. ${pc.dim("# Build and deploy once:")}`,
      `     ${pc.cyan(`${run} deploy`)}`,
      "",
      `  ${4 + stepOffset}. ${pc.dim(appOpenHint)}`,
      `     ${pc.cyan(openCommand)}`,
      "",
      `  ${5 + stepOffset}. ${pc.dim("# (Optional) Start local dev server (mkcert required):")}`,
      `     ${pc.cyan(`${run} setup:certs`)}`,
      `     ${pc.cyan(`${run} dev`)}`,
      "",
      pc.dim("  Docs: https://github.com/vazhioli/create-gas-app"),
    ].join("\n"),
    pc.bold(pc.green("  Ready!  ")),
  );

  p.outro(
    `Issues? ${pc.cyan("https://github.com/vazhioli/create-gas-app/issues")}`,
  );
}
