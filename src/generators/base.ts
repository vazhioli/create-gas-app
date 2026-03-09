import type { GasAddonType, ProjectConfig } from "../types.js";
import { writeFile, writeJsonFile, projectPath } from "../utils/fs.js";
import { GAS_CLIENT_ESM_URL } from "../constants/scaffold.js";

// ─── appsscript.json ─────────────────────────────────────────────────────────

const OAUTH_SCOPES: Record<GasAddonType, string[]> = {
  sheets: [
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  docs: [
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  forms: [
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/forms",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  standalone: [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};

// ─── .gitignore ──────────────────────────────────────────────────────────────

const GITIGNORE = `# dependencies
node_modules
.pnp
.pnp.js

# build output
dist

# environment & secrets
apps/*/env.ts
packages/server/src/env.ts
*.pem
certs/

# clasp — commit the environment-specific configs you need
.clasp.json

# misc
.DS_Store
*.tsbuildinfo
`;

const PRETTIERIGNORE = `# lockfiles
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lock

# generated output
dist
`;

// ─── tsconfig.json (root — covers all workspaces) ────────────────────────────

const tsconfigJson = (config: ProjectConfig) => {
  const scope = `@${config.projectName}`;

  const jsxFields =
    config.framework === "solid"
      ? { jsx: "preserve", jsxImportSource: "solid-js" }
      : config.framework === "react"
        ? { jsx: "react-jsx" }
        : {};

  return {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM"],
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      ...jsxFields,
      paths: {
        // Workspace packages — resolved to source so Vite skips tsc compilation
        [`${scope}/server`]: ["./packages/server/src/index.ts"],
        [`${scope}/server/*`]: ["./packages/server/src/*"],
        [`${scope}/ui`]: ["./packages/ui/src/index.ts"],
        [`${scope}/ui/*`]: ["./packages/ui/src/*"],
        [`${scope}/shared`]: ["./packages/shared/src/index.ts"],
        [`${scope}/shared/*`]: ["./packages/shared/src/*"],
      },
    },
    include: ["apps/**/*", "packages/**/*", "vite.config.ts"],
    exclude: ["node_modules", "dist"],
  };
};

// ─── packages/server/templates/dev-dialog-bridge.html ───────────────────────

const devServerWrapperHtml = () => `<!--
  Development server wrapper for Google Apps Script dialogs.

  GAS serves this file during local development. It iframes your Vite dev
  server and bridges google.script.run calls via postMessage — so you get
  live reload without a full clasp push on every change.

  Placeholders replaced at build time:
    __PORT__      → Vite dev server port
    __FILE_NAME__ → Dialog entry (e.g. sidebar/index.html)
-->
<!doctype html>
<html>
  <head>
    <base target="_top" />
    <title>Dev Server</title>
    <script type="importmap">
      {
        "imports": {
          "gas-client": "${GAS_CLIENT_ESM_URL}"
        }
      }
    </script>
    <style>body, html { margin: 0; width: 100%; height: 100%; }</style>
    <script type="module">
      import { GASClient } from "gas-client";
      document.addEventListener("DOMContentLoaded", function () {
        const PORT = "__PORT__";
        const FILE_NAME = "__FILE_NAME__";

        const iframe = document.getElementById("iframe");
        iframe.src = "https://localhost:" + PORT + "/" + FILE_NAME;

        const { serverFunctions, scriptHostFunctions } =
          new GASClient({
            allowedDevelopmentDomains: (origin) =>
              /https:\\/\\/.+\\.googleusercontent\\.com$/.test(origin),
          });

        window.addEventListener("message", function (event) {
          const { type, functionName, id, args } = event.data;
          if (type === "SCRIPT_HOST_FUNCTION_REQUEST") {
            scriptHostFunctions[functionName](...args);
            return;
          }
          if (type !== "REQUEST") return;
          serverFunctions[functionName](...args)
            .then((response) =>
              iframe.contentWindow.postMessage(
                { type: "RESPONSE", id, status: "SUCCESS", response },
                "https://localhost:" + PORT,
              ),
            )
            .catch((err) =>
              iframe.contentWindow.postMessage(
                { type: "RESPONSE", id, status: "ERROR", response: err },
                "https://localhost:" + PORT,
              ),
            );
        }, false);
      });
    </script>
  </head>
  <body>
    <div style="width:100%;height:100%">
      <iframe id="iframe" style="width:100%;height:100%;border:0;position:absolute"></iframe>
    </div>
  </body>
</html>
`;

// ─── .claspignore ────────────────────────────────────────────────────────────

const CLASPIGNORE = `# rootDir is already "./dist" in .clasp.json
# so patterns here are evaluated within dist/
node_modules/**
*.md
`;

// ─── Workspace package.json helpers ──────────────────────────────────────────

const workspacePkg = (name: string, extraFields: object = {}) => ({
  name,
  version: "0.0.0",
  private: true,
  type: "module",
  exports: {
    ".": "./src/index.ts",
    "./*": "./src/*",
  },
  ...extraFields,
});

// ─── Workspace tsconfig.json helpers ─────────────────────────────────────────

const workspaceTsconfig = (rootRelative: string) => ({
  extends: `${rootRelative}/tsconfig.json`,
  include: ["src/**/*"],
});

const serverTsconfig = (rootRelative: string) => ({
  extends: `${rootRelative}/tsconfig.json`,
  compilerOptions: {
    types: ["gas-types-detailed"],
  },
  include: ["src/**/*", "templates/**/*"],
});

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateBase(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const pp = (...s: string[]) => projectPath(root, ...s);
  const scope = `@${config.projectName}`;

  // Root files
  await writeJsonFile(pp("appsscript.json"), {
    timeZone: "America/New_York",
    exceptionLogging: "STACKDRIVER",
    runtimeVersion: "V8",
    oauthScopes: OAUTH_SCOPES[config.addonType],
  });

  await writeFile(pp(".claspignore"), CLASPIGNORE);
  await writeFile(pp(".gitignore"), GITIGNORE);
  await writeFile(pp(".prettierignore"), PRETTIERIGNORE);
  await writeJsonFile(pp("tsconfig.json"), tsconfigJson(config));
  await writeFile(
    pp("packages", "server", "templates", "dev-dialog-bridge.html"),
    devServerWrapperHtml(),
  );

  // ── Workspace package manifests ──────────────────────────────────────────

  // packages/server
  await writeJsonFile(
    pp("packages", "server", "package.json"),
    workspacePkg(`${scope}/server`),
  );
  await writeJsonFile(
    pp("packages", "server", "tsconfig.json"),
    serverTsconfig("../.."),
  );

  // packages/ui
  await writeJsonFile(
    pp("packages", "ui", "package.json"),
    workspacePkg(`${scope}/ui`),
  );
  await writeJsonFile(
    pp("packages", "ui", "tsconfig.json"),
    workspaceTsconfig("../.."),
  );

  // packages/shared
  await writeJsonFile(
    pp("packages", "shared", "package.json"),
    workspacePkg(`${scope}/shared`),
  );
  await writeJsonFile(
    pp("packages", "shared", "tsconfig.json"),
    workspaceTsconfig("../.."),
  );
}
