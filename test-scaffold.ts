/**
 * Integration test — runs the scaffold generators directly
 * and verifies key files are generated for each framework + addon combo.
 *
 * Usage: bun test-scaffold.ts
 */
import path from "path";
import fs from "fs";
import { generateBase } from "./src/generators/base.js";
import { generateServer } from "./src/generators/server.js";
import { generateClient } from "./src/generators/client.js";
import { generateViteConfig } from "./src/generators/vite.js";
import { generatePackageJson } from "./src/generators/pkg.js";
import { generateTailwind } from "./src/generators/addons/tailwind.js";
import { generateShadcn } from "./src/generators/addons/shadcn.js";
import { generateCommitlint } from "./src/generators/addons/commitlint.js";
import type { ProjectConfig } from "./src/types.js";

const BASE_DIR = "/tmp/gas-scaffold-test";

const CONFIGS: Array<{ label: string; config: ProjectConfig }> = [
  {
    label: "React + all addons (Sheets)",
    config: {
      projectName: "test-react-sheets",
      addonType: "sheets",
      framework: "react",
      addons: ["tailwind", "shadcn", "commitlint"],
      packageManager: "bun",
      installDeps: false,
      initGit: false,
    },
  },
  {
    label: "Vue + Tailwind (Docs)",
    config: {
      projectName: "test-vue-docs",
      addonType: "docs",
      framework: "vue",
      addons: ["tailwind", "commitlint"],
      packageManager: "npm",
      installDeps: false,
      initGit: false,
    },
  },
  {
    label: "Svelte + no addons (Forms)",
    config: {
      projectName: "test-svelte-forms",
      addonType: "forms",
      framework: "svelte",
      addons: [],
      packageManager: "pnpm",
      installDeps: false,
      initGit: false,
    },
  },
  {
    label: "SolidJS + Tailwind (Standalone)",
    config: {
      projectName: "test-solid-standalone",
      addonType: "standalone",
      framework: "solid",
      addons: ["tailwind"],
      packageManager: "npm",
      installDeps: false,
      initGit: false,
    },
  },
];

async function scaffold(root: string, config: ProjectConfig) {
  await generateBase(root, config);
  await generateServer(root, config);
  await generateClient(root, config);
  await generateViteConfig(root, config);
  await generatePackageJson(root, config);
  const hasTailwind =
    config.addons.includes("tailwind") || config.addons.includes("shadcn");
  if (hasTailwind) await generateTailwind(root, config);
  if (config.addons.includes("shadcn")) await generateShadcn(root, config);
  if (config.addons.includes("commitlint")) await generateCommitlint(root, config);
}

// ─── Required files for every project ────────────────────────────────────────

const REQUIRED_FILES = [
  // Root
  "appsscript.json",
  ".gitignore",
  ".prettierignore",
  "tsconfig.json",
  "vite.config.ts",
  "package.json",
  // Dev bridge
  "packages/server/templates/dev-dialog-bridge.html",
  // packages/server
  "packages/server/package.json",
  "packages/server/tsconfig.json",
  "packages/server/src/index.ts",
  "packages/server/src/env.ts",
  "packages/server/src/ui.ts",
  // packages/shared
  "packages/shared/package.json",
  "packages/shared/tsconfig.json",
  "packages/shared/src/index.ts",
  "packages/shared/src/utils.ts",
  "packages/shared/src/utils/server.ts",
  "packages/shared/src/styles/global.css",
  // packages/ui
  "packages/ui/package.json",
  "packages/ui/tsconfig.json",
  "packages/ui/src/index.ts",
  // apps/<projectName> — single package, dialogs are subdirs
  // (paths checked per-config below since they include the project name)
];

// ─── Framework-specific entry files ──────────────────────────────────────────

// Framework files are checked per-config since they include the project name

// ─── Addon-specific files ─────────────────────────────────────────────────────

const ADDON_FILES: Record<string, string[]> = {
  shadcn: ["components.json", "packages/ui/src/components/button.tsx"],
  commitlint: ["lefthook.yml", ".commitlintrc.json"],
};

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

for (const { label, config } of CONFIGS) {
  const root = path.join(BASE_DIR, config.projectName);
  fs.rmSync(root, { recursive: true, force: true });

  console.log(`\n── ${label} ──`);
  await scaffold(root, config);

  for (const file of REQUIRED_FILES) {
    check(fs.existsSync(path.join(root, file)), file);
  }

  // apps/<projectName> package + dialog files
  const appBase = `apps/${config.projectName}`;
  const dialogsBase = `${appBase}/dialogs`;
  check(fs.existsSync(path.join(root, appBase, "package.json")), `${appBase}/package.json`);
  check(fs.existsSync(path.join(root, appBase, "env.ts")), `${appBase}/env.ts`);
  check(
    fs.existsSync(path.join(root, dialogsBase, "sidebar/index.html")),
    `${dialogsBase}/sidebar/index.html`,
  );

  // about dialog — present for addon types, absent for standalone
  const isAddon = config.addonType !== "standalone";
  check(
    fs.existsSync(path.join(root, dialogsBase, "about/index.html")) === isAddon,
    `${dialogsBase}/about/index.html ${isAddon ? "present" : "absent"} for ${config.addonType}`,
  );

  const fwExts: Record<string, { main: string; app: string }> = {
    react: { main: "tsx", app: "tsx" },
    vue: { main: "ts", app: "vue" },
    svelte: { main: "ts", app: "svelte" },
    solid: { main: "tsx", app: "tsx" },
  };
  const { main, app } = fwExts[config.framework];
  check(
    fs.existsSync(path.join(root, dialogsBase, `sidebar/src/main.${main}`)),
    `${dialogsBase}/sidebar/src/main.${main}`,
  );
  check(
    fs.existsSync(path.join(root, dialogsBase, `sidebar/src/App.${app}`)),
    `${dialogsBase}/sidebar/src/App.${app}`,
  );
  const sidebarHtml = fs.readFileSync(
    path.join(root, dialogsBase, "sidebar/index.html"),
    "utf-8",
  );
  check(
    sidebarHtml.includes('type="importmap"'),
    `${dialogsBase}/sidebar/index.html has importmap`,
  );
  const importMapChecks: Record<string, string[]> = {
    react: ['"react"', '"react-dom/"', '"gas-client"'],
    vue: ['"vue"', '"gas-client"'],
    svelte: ['"svelte"', '"svelte/"', '"gas-client"'],
    solid: ['"solid-js"', '"solid-js/"', '"gas-client"'],
  };
  for (const needle of importMapChecks[config.framework]) {
    check(
      sidebarHtml.includes(needle),
      `${dialogsBase}/sidebar/index.html importmap contains ${needle}`,
    );
  }
  check(
    !fs.existsSync(path.join(root, dialogsBase, "sidebar/package.json")),
    `${dialogsBase}/sidebar/package.json is not generated`,
  );
  check(
    !fs.existsSync(path.join(root, dialogsBase, "about/package.json")),
    `${dialogsBase}/about/package.json is not generated`,
  );

  for (const addon of config.addons) {
    for (const file of ADDON_FILES[addon] ?? []) {
      check(fs.existsSync(path.join(root, file)), file);
    }
  }

  // ── package.json content checks ─────────────────────────────────────────────
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  check(pkg.name === config.projectName, `package.json name = "${config.projectName}"`);
  check(Array.isArray(pkg.workspaces), "package.json has workspaces");
  check(typeof pkg.scripts?.dev === "string", "package.json has scripts.dev");
  check(typeof pkg.scripts?.deploy === "string", "package.json has scripts.deploy");
  check(pkg.prettier === undefined, "package.json does not include custom prettier config");
  const expectedClaspType: Record<ProjectConfig["addonType"], string> = {
    sheets: "sheets",
    docs: "docs",
    forms: "forms",
    standalone: "standalone",
  };
  check(
    pkg.scripts?.["clasp:create"]?.includes(`--type ${expectedClaspType[config.addonType]}`),
    `clasp:create uses ${config.addonType} type`,
  );
  check(
    pkg.scripts?.["clasp:create"]?.includes(`--title '${config.projectName}'`),
    "clasp:create uses project name as title",
  );
  check(
    pkg.scripts?.["clasp:open:script"] === "clasp open-script",
    "clasp:open:script uses open-script",
  );
  check(
    pkg.scripts?.["clasp:open:container"] ===
      (config.addonType === "standalone"
        ? "echo 'No container for standalone projects'"
        : "clasp open-container"),
    `clasp:open:container is correct for ${config.addonType}`,
  );
  check(!!pkg.dependencies?.["gas-client"], "gas-client in dependencies");

  if (config.addons.includes("tailwind") || config.addons.includes("shadcn")) {
    check(!!pkg.devDependencies?.tailwindcss, "tailwindcss in devDependencies");
  }
  if (config.addons.includes("commitlint")) {
    check(!!pkg.devDependencies?.["@commitlint/cli"], "@commitlint/cli in devDependencies");
  }

  // ── apps/<projectName>/package.json has workspace deps ───────────────────────
  const appPkg = JSON.parse(
    fs.readFileSync(path.join(root, `apps/${config.projectName}/package.json`), "utf-8"),
  );
  check(
    appPkg.dependencies?.[`@${config.projectName}/shared`] === "workspace:*",
    `apps/${config.projectName} depends on @scope/shared`,
  );

  // ── packages/shared/src/utils/server.ts references workspace scope ──────────
  const serverBridge = fs.readFileSync(
    path.join(root, "packages/shared/src/utils/server.ts"),
    "utf-8",
  );
  check(
    serverBridge.includes(`@${config.projectName}/server`),
    "shared/utils/server.ts imports @scope/server",
  );

  // ── sidebar App has About button for addon types ─────────────────────────────
  const fwExtsApp: Record<string, string> = { react: "tsx", vue: "vue", svelte: "svelte", solid: "tsx" };
  const sidebarApp = fs.readFileSync(
    path.join(root, dialogsBase, `sidebar/src/App.${fwExtsApp[config.framework]}`),
    "utf-8",
  );
  check(
    sidebarApp.includes("openAboutDialog") === isAddon,
    `sidebar App ${isAddon ? "has" : "omits"} About button`,
  );

  // ── vite.config.ts has correct framework plugin ──────────────────────────────
  const vite = fs.readFileSync(path.join(root, "vite.config.ts"), "utf-8");
  const fwPlugins: Record<string, string> = {
    react: "plugin-react-swc",
    vue: "plugin-vue",
    svelte: "plugin-svelte",
    solid: "plugin-solid",
  };
  check(vite.includes(fwPlugins[config.framework]), `vite.config.ts has ${config.framework} plugin`);
  check(vite.includes("packages/server"), "vite.config.ts references packages/server");
  check(
    vite.includes('"@' + config.projectName + '/shared": resolve(__dirname, "packages/shared/src")'),
    "vite.config.ts aliases @scope/shared to source directory",
  );
  check(vite.includes('output: { format: "es" }'), 'vite.config.ts client output format is "es"');
  const externalChecks: Record<string, string[]> = {
    react: ['"react"', '"react-dom"', '"gas-client"'],
    vue: ['"vue"', '"gas-client"'],
    svelte: ['"svelte"', '"gas-client"'],
    solid: ['"solid-js"', '"gas-client"'],
  };
  for (const needle of externalChecks[config.framework]) {
    check(vite.includes(needle), `vite.config.ts external contains ${needle}`);
  }
  check(
    vite.includes(`filename: "about"`) === isAddon,
    `vite.config.ts ${isAddon ? "has" : "omits"} about entrypoint`,
  );

  // ── packages/server/src/ui.ts has correct addon type and no template injection ─
  const ui = fs.readFileSync(path.join(root, "packages/server/src/ui.ts"), "utf-8");
  if (config.addonType === "standalone") {
    check(ui.includes("doGet"), "packages/server/src/ui.ts has doGet for standalone");
  } else {
    check(ui.includes("onOpen"), "packages/server/src/ui.ts has onOpen");
    check(!ui.includes("asTemplate"), "packages/server/src/ui.ts uses no template injection");
    check(
      isAddon && ui.includes("openAboutDialog"),
      "packages/server/src/ui.ts exports openAboutDialog",
    );
  }

  // ── tsconfig.json has workspace path aliases ─────────────────────────────────
  const tsconfig = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.json"), "utf-8"));
  check(
    !!tsconfig.compilerOptions?.paths?.[`@${config.projectName}/server`],
    "tsconfig.json has @scope/server path alias",
  );

  // ── .claspignore should not exclude rootDir files ───────────────────────────
  const claspIgnore = fs.readFileSync(path.join(root, ".claspignore"), "utf-8");
  check(!claspIgnore.includes("**/*"), ".claspignore does not exclude all files");
  check(!claspIgnore.includes("!dist/**"), ".claspignore has no dist re-include pattern");
}

console.log(`\n─────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All checks passed!");
}
