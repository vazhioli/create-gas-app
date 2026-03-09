import type { Framework, ProjectConfig } from "../types.js";
import { hasTailwind } from "../types.js";
import { writeFile, projectPath } from "../utils/fs.js";
import { CLIENT_EXTERNALS } from "../constants/scaffold.js";

const FRAMEWORK_PLUGIN: Record<
  Framework,
  { importLine: string; pluginCall: string }
> = {
  react: {
    importLine: `import react from "@vitejs/plugin-react-swc";`,
    pluginCall: "react()",
  },
  vue: {
    importLine: `import vue from "@vitejs/plugin-vue";`,
    pluginCall: "vue()",
  },
  svelte: {
    importLine: `import { svelte } from "@sveltejs/vite-plugin-svelte";`,
    pluginCall: "svelte()",
  },
  solid: {
    importLine: `import solid from "vite-plugin-solid";`,
    pluginCall: "solid()",
  },
};

const viteConfigTs = (config: ProjectConfig) => {
  const fw = FRAMEWORK_PLUGIN[config.framework];
  const tw = hasTailwind(config.addons);
  const scope = `@${config.projectName}`;
  const clientExternals = JSON.stringify(CLIENT_EXTERNALS[config.framework]);

  const tailwindImport = tw ? `import tailwindcss from "@tailwindcss/vite";\n` : "";
  const tailwindPlugin = tw ? "\n    tailwindcss()," : "";

  return `import { existsSync, readFileSync } from "fs";
import { writeFile } from "fs/promises";
import { resolve } from "path";
${fw.importLine}
${tailwindImport}import { build, type BuildOptions, defineConfig, type ServerOptions } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { viteStaticCopy } from "vite-plugin-static-copy";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || 3000);
const APPS_ROOT = "./apps/${config.projectName}/dialogs";
const OUT_DIR = "./dist";
const SERVER_ENTRY = "packages/server/src/index.ts";
const APPSSCRIPT_ENTRY = "./appsscript.json";
const DEV_WRAPPER = "./packages/server/templates/dev-dialog-bridge.html";

// ─── Dialog entrypoints ───────────────────────────────────────────────────────
// Each entry → one HTML file in dist/ and one dialog/sidebar in GAS.
// Add entries here when you run: npx create-gas-app add dialog <name>

const entrypoints = [
  {
    name: "Sidebar",
    filename: "sidebar",
    appDir: "sidebar",       // apps/${config.projectName}/dialogs/sidebar/
    template: "index.html",  // apps/${config.projectName}/dialogs/sidebar/index.html
  },
  ${config.addonType !== "standalone" ? `{
    name: "About",
    filename: "about",
    appDir: "about",         // apps/${config.projectName}/dialogs/about/
    template: "index.html",
  },` : "// Standalone web apps don't use modal dialogs — add entrypoints here if needed."}
  // {
  //   name: "Settings",
  //   filename: "settings",
  //   appDir: "settings",
  //   template: "index.html",
  // },
];

// ─── Workspace package aliases ────────────────────────────────────────────────
// Maps ${scope}/* imports to their workspace source so Vite resolves
// them directly without a separate compilation step.

const workspaceAlias = {
  "${scope}/server": resolve(__dirname, "packages/server/src"),
  "${scope}/ui": resolve(__dirname, "packages/ui/src"),
  "${scope}/shared": resolve(__dirname, "packages/shared/src"),
};

// ─── HTTPS for local dev ──────────────────────────────────────────────────────
// GAS requires HTTPS for iframed origins.
// Generate certs with: npm run setup:certs  (uses mkcert)

const keyPath = resolve(__dirname, "./certs/key.pem");
const certPath = resolve(__dirname, "./certs/cert.pem");
const devServerOptions: ServerOptions = { port: PORT };
if (existsSync(keyPath) && existsSync(certPath)) {
  devServerOptions.https = {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}

// ─── Client build (each app/ → inlined single-file HTML) ─────────────────────

const clientBuildConfig = (appDir: string, template: string) =>
  defineConfig({
    plugins: [
      ${fw.pluginCall},${tailwindPlugin}
      viteSingleFile({ useRecommendedBuildConfig: true }),
    ],
    resolve: {
      alias: {
        // Resolve workspace packages from source
        ...workspaceAlias,
        // Also support deep imports like @pkg/shared/utils/server
        "${scope}/server/": resolve(__dirname, "packages/server/src/") + "/",
        "${scope}/ui/": resolve(__dirname, "packages/ui/src/") + "/",
        "${scope}/shared/": resolve(__dirname, "packages/shared/src/") + "/",
      },
    },
    root: resolve(__dirname, APPS_ROOT, appDir),
    build: {
      sourcemap: false,
      write: false,
      outDir: OUT_DIR,
      emptyOutDir: false,
      minify: true,
      rollupOptions: {
        external: ${clientExternals},
        output: { format: "es" },
        input: resolve(__dirname, APPS_ROOT, appDir, template),
      },
    },
    esbuild: { legalComments: "none" },
  });

// ─── Server build (packages/server → dist/code.js ES, exports stripped) ──────
// GAS needs functions as top-level declarations — ES format produces that,
// but Rollup appends "export { fn1, fn2, ... }" which GAS doesn't support.
// The plugin below strips that trailing export statement.

const serverBuildConfig: BuildOptions = {
  emptyOutDir: true,
  minify: false, // minification breaks some GAS runtime patterns
  lib: {
    entry: resolve(__dirname, SERVER_ENTRY),
    fileName: "code",
    formats: ["es"],
  },
  rollupOptions: {
    plugins: [
      {
        name: "strip-gas-exports",
        renderChunk(code: string) {
          return { code: code.replace(/\\nexport\\s*\\{[^}]*\\};\\s*$/, ""), map: null };
        },
      },
    ],
    output: {
      entryFileNames: "code.js",
    },
  },
};

// ─── Main config export ───────────────────────────────────────────────────────

export default async ({
  command,
  mode,
}: {
  command: string;
  mode: string;
}) => {
  const sharedResolve = {
    alias: {
      ...workspaceAlias,
      "${scope}/server/": resolve(__dirname, "packages/server/src/") + "/",
      "${scope}/ui/": resolve(__dirname, "packages/ui/src/") + "/",
      "${scope}/shared/": resolve(__dirname, "packages/shared/src/") + "/",
    },
  };

  if (command === "serve") {
    // Dev: serve apps/ locally — each app at /<appDir>/index.html
    return defineConfig({
      plugins: [${fw.pluginCall},${tailwindPlugin}],
      resolve: { ...sharedResolve, dedupe: [] },
      server: devServerOptions,
      root: APPS_ROOT,
    });
  }

  // Build: server ES bundle + static file copies + client HTML bundles
  const copyTargets = [{ src: APPSSCRIPT_ENTRY, dest: "./" }];

  if (mode === "development") {
    // Dev mode: each dialog is an iframe wrapper pointing to the Vite dev server
    copyTargets.push(
      ...entrypoints.map((ep) => ({
        src: DEV_WRAPPER,
        dest: "./",
        rename: \`\${ep.filename}.html\`,
        transform: (contents: string) =>
          contents
            .toString()
            .replace(/__PORT__/g, String(PORT))
            .replace(/__FILE_NAME__/g, \`\${ep.appDir}/\${ep.template}\`),
      })),
    );
  }

  return defineConfig({
    plugins: [
      viteStaticCopy({ targets: copyTargets }),
      mode === "production" && {
        name: "build-client-bundles",
        // Runs after the server bundle (dist/code.js) is written
        closeBundle: async () => {
          for (const ep of entrypoints) {
            const output = await build(clientBuildConfig(ep.appDir, ep.template));
            await writeFile(
              resolve(__dirname, OUT_DIR, \`\${ep.filename}.html\`),
              // @ts-expect-error — output is RollupOutput[]
              output.output[0].source,
            );
          }
        },
      },
    ].filter(Boolean),
    resolve: sharedResolve,
    build: serverBuildConfig,
  });
};
`;
};

export async function generateViteConfig(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  await writeFile(projectPath(root, "vite.config.ts"), viteConfigTs(config));
}
