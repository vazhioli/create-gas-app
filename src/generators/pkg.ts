import type {
  Framework,
  GasAddonType,
  PackageManager,
  ProjectConfig,
} from "../types.js";
import { writeJsonFile, projectPath } from "../utils/fs.js";
import {
  ADDON_DEPS,
  ESLINT_FRAMEWORK_DEPS,
  FRAMEWORK_DEPS,
  ROOT_DEV_DEPENDENCIES,
} from "../constants/scaffold.js";

// ─── Scripts ──────────────────────────────────────────────────────────────────

function getClaspCreateType(addonType: GasAddonType): string {
  switch (addonType) {
    case "sheets":
      return "sheets";
    case "docs":
      return "docs";
    case "forms":
      return "forms";
    case "standalone":
      return "standalone";
  }
}

function getScripts(
  pm: PackageManager,
  addonType: GasAddonType,
  projectName: string,
  hasEslint = false,
) {
  const r = (s: string) => `${pm} run ${s}`;
  const claspType = getClaspCreateType(addonType);
  const openContainerScript =
    addonType === "standalone"
      ? "echo 'No container for standalone projects'"
      : "clasp open-container";

  return {
    dev: `${r("deploy:dev")} && cross-env PORT=\${PORT:-3000} vite`,
    build: "cross-env NODE_ENV=production vite build --mode production",
    "build:dev":
      "cross-env NODE_ENV=development PORT=${PORT:-3000} vite build --mode development",
    deploy: `${r("build")} && ${r("clasp:push")}`,
    "deploy:dev": `${r("build:dev")} && ${r("clasp:push")}`,
    "clasp:login": "clasp login",
    "clasp:create": `rimraf .clasp.json && mkdir -p dist && clasp create --type ${claspType} --title '${projectName}' --rootDir './dist'`,
    "clasp:push": "clasp push --force",
    "clasp:open:script": "clasp open-script",
    "clasp:open:container": openContainerScript,
    "setup:certs":
      "mkdir -p certs && mkcert -key-file ./certs/key.pem -cert-file ./certs/cert.pem localhost 127.0.0.1",
    format: "prettier --write --ignore-unknown .",
    prepare: "lefthook install || true",
    ...(hasEslint ? {
      lint: "eslint .",
      "lint:fix": "eslint . --fix",
    } : {}),
  };
}

// ─── Workspace package.json for each app ─────────────────────────────────────

const appPkg = (
  projectName: string,
  appName: string,
  fw: Framework,
  hasUi: boolean,
) => {
  const scope = `@${projectName}`;
  const fwDeps = FRAMEWORK_DEPS[fw].dependencies;
  return {
    name: `${scope}/${appName}`,
    version: "0.0.0",
    private: true,
    type: "module",
    dependencies: {
      "gas-client": "^1.2.1",
      ...fwDeps,
      ...(hasUi ? { [`${scope}/ui`]: "workspace:*" } : {}),
      [`${scope}/shared`]: "workspace:*",
    },
  };
};

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generatePackageJson(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const pp = (...s: string[]) => projectPath(root, ...s);
  const scope = `@${config.projectName}`;
  const fw = FRAMEWORK_DEPS[config.framework];

  // ── Root devDependencies (build toolchain, no runtime deps at root) ────────
  const devDependencies: Record<string, string> = {
    ...ROOT_DEV_DEPENDENCIES,
    ...fw.devDependencies,
  };

  // ── Runtime deps shared across packages go at root ─────────────────────────
  // (hoisted by workspaces — keeps each package.json lean)
  const dependencies: Record<string, string> = {
    "gas-client": "^1.2.1",
    ...fw.dependencies,
  };

  for (const addon of config.addons) {
    Object.assign(devDependencies, ADDON_DEPS[addon]?.dev ?? {});
    Object.assign(dependencies, ADDON_DEPS[addon]?.prod ?? {});
  }

  if (config.addons.includes("eslint")) {
    Object.assign(devDependencies, ESLINT_FRAMEWORK_DEPS[config.framework]);
  }

  const lintStagedConfig = config.addons.includes("commitlint")
    ? { "lint-staged": { "*": "prettier --write --ignore-unknown" } }
    : {};

  // ── Root package.json ──────────────────────────────────────────────────────
  await writeJsonFile(pp("package.json"), {
    name: config.projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    workspaces: ["apps/*", "packages/*"],
    scripts: getScripts(
      config.packageManager,
      config.addonType,
      config.projectName,
      config.addons.includes("eslint"),
    ),
    dependencies,
    devDependencies,
    ...lintStagedConfig,
  });

  // ── apps/<projectName>/package.json — single package for all dialogs ──────
  const hasUi = config.addons.includes("shadcn");
  await writeJsonFile(
    pp("apps", config.projectName, "package.json"),
    appPkg(config.projectName, config.projectName, config.framework, hasUi),
  );

  // ── packages/server/package.json adds server-specific deps ────────────────
  // (gas-types-detailed is hoisted at root; nothing extra needed here)
}
