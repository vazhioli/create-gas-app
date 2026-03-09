import type { Framework, GasAddonType } from "../types.js";

export const NAME_PATTERN = /^[a-z0-9_-]+$/i;

// ─── Single source of truth for all dependency versions ───────────────────────
// Update versions here only — all package.json generation and esm.sh import
// maps derive their values from this object.

export const DEPENDENCY_VERSIONS = {
  // React
  react: "^19.2.4",
  "react-dom": "^19.2.4",
  "@vitejs/plugin-react-swc": "^4.2.2",
  "@types/react": "^19.2.14",
  "@types/react-dom": "^19.2.3",
  // Vue
  vue: "^3.5.0",
  "@vitejs/plugin-vue": "^5.2.0",
  "vue-tsc": "^2.0.0",
  // Svelte
  svelte: "^5.0.0",
  "@sveltejs/vite-plugin-svelte": "^4.0.0",
  "svelte-check": "^4.0.0",
  // Solid
  "solid-js": "^1.9.0",
  "vite-plugin-solid": "^2.11.0",
  // Core GAS runtime
  "gas-client": "^1.2.1",
  // Tailwind
  tailwindcss: "^4.1.18",
  "@tailwindcss/vite": "^4.1.18",
  "tw-animate-css": "^1.4.0",
  // shadcn/ui
  shadcn: "^4.0.1",
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  "tailwind-merge": "^3.5.0",
  "radix-ui": "^1.4.3",
  "lucide-react": "^0.577.0",
  // Commitlint
  lefthook: "^2.1.1",
  "@commitlint/cli": "^20.4.2",
  "@commitlint/config-conventional": "^20.4.2",
  "lint-staged": "^16.2.7",
  // ESLint core
  eslint: "^9.20.0",
  "@eslint/js": "^9.20.0",
  "typescript-eslint": "^8.25.0",
  // ESLint framework plugins
  "eslint-plugin-react-hooks": "^5.2.0",
  "eslint-plugin-react-refresh": "^0.4.19",
  "eslint-plugin-vue": "^9.33.0",
  "eslint-plugin-svelte": "^2.47.0",
  "eslint-plugin-solid": "^0.14.5",
  // Root toolchain
  "@google/clasp": "^3.2.0",
  "gas-types-detailed": "^1.1.3",
  "cross-env": "^10.1.0",
  rimraf: "^6.1.3",
  typescript: "^5.9.3",
  vite: "^7.3.1",
  "vite-plugin-singlefile": "^2.3.0",
  "vite-plugin-static-copy": "^3.2.0",
  prettier: "^3.8.1",
} as const;

type DepName = keyof typeof DEPENDENCY_VERSIONS;

// Builds an esm.sh CDN URL, stripping the leading ^ from the semver range.
// Pass suffix "/" for sub-path import map entries (e.g. "react-dom/").
const esmUrl = (pkg: DepName, suffix = "") =>
  `https://esm.sh/${pkg}@${DEPENDENCY_VERSIONS[pkg].replace(/^\^/, "")}${suffix}`;

// Convenience aliases used by other modules
export const GAS_CLIENT_DEP = DEPENDENCY_VERSIONS["gas-client"];
export const GAS_CLIENT_ESM_URL = esmUrl("gas-client");

// ─── Non-version constants ────────────────────────────────────────────────────

export const APP_SERVICE: Record<GasAddonType, string> = {
  sheets: "SpreadsheetApp",
  docs: "DocumentApp",
  forms: "FormApp",
  standalone: "",
};

export const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, Arial, Roboto, 'Helvetica Neue', sans-serif";

// ─── Dependency maps (derived from DEPENDENCY_VERSIONS) ───────────────────────

const v = (pkg: DepName) => DEPENDENCY_VERSIONS[pkg];

export const FRAMEWORK_DEPS: Record<
  Framework,
  {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  }
> = {
  react: {
    dependencies: { react: v("react"), "react-dom": v("react-dom") },
    devDependencies: {
      "@vitejs/plugin-react-swc": v("@vitejs/plugin-react-swc"),
      "@types/react": v("@types/react"),
      "@types/react-dom": v("@types/react-dom"),
    },
  },
  vue: {
    dependencies: { vue: v("vue") },
    devDependencies: { "@vitejs/plugin-vue": v("@vitejs/plugin-vue"), "vue-tsc": v("vue-tsc") },
  },
  svelte: {
    dependencies: { svelte: v("svelte") },
    devDependencies: {
      "@sveltejs/vite-plugin-svelte": v("@sveltejs/vite-plugin-svelte"),
      "svelte-check": v("svelte-check"),
    },
  },
  solid: {
    dependencies: { "solid-js": v("solid-js") },
    devDependencies: { "vite-plugin-solid": v("vite-plugin-solid") },
  },
};

export const ADDON_DEPS = {
  tailwind: {
    dev: {
      tailwindcss: v("tailwindcss"),
      "@tailwindcss/vite": v("@tailwindcss/vite"),
      "tw-animate-css": v("tw-animate-css"),
    },
    prod: {} as Record<string, string>,
  },
  shadcn: {
    dev: { shadcn: v("shadcn") },
    prod: {
      "class-variance-authority": v("class-variance-authority"),
      clsx: v("clsx"),
      "tailwind-merge": v("tailwind-merge"),
      "radix-ui": v("radix-ui"),
      "lucide-react": v("lucide-react"),
    },
  },
  commitlint: {
    dev: {
      lefthook: v("lefthook"),
      "@commitlint/cli": v("@commitlint/cli"),
      "@commitlint/config-conventional": v("@commitlint/config-conventional"),
      "lint-staged": v("lint-staged"),
    },
    prod: {} as Record<string, string>,
  },
  eslint: {
    dev: {
      eslint: v("eslint"),
      "@eslint/js": v("@eslint/js"),
      "typescript-eslint": v("typescript-eslint"),
    },
    prod: {} as Record<string, string>,
  },
} as const;

export const ESLINT_FRAMEWORK_DEPS: Record<Framework, Record<string, string>> = {
  react: {
    "eslint-plugin-react-hooks": v("eslint-plugin-react-hooks"),
    "eslint-plugin-react-refresh": v("eslint-plugin-react-refresh"),
  },
  vue: { "eslint-plugin-vue": v("eslint-plugin-vue") },
  svelte: { "eslint-plugin-svelte": v("eslint-plugin-svelte") },
  solid: { "eslint-plugin-solid": v("eslint-plugin-solid") },
};

export const ROOT_DEV_DEPENDENCIES: Record<string, string> = {
  "@google/clasp": v("@google/clasp"),
  "gas-types-detailed": v("gas-types-detailed"),
  "cross-env": v("cross-env"),
  rimraf: v("rimraf"),
  typescript: v("typescript"),
  vite: v("vite"),
  "vite-plugin-singlefile": v("vite-plugin-singlefile"),
  "vite-plugin-static-copy": v("vite-plugin-static-copy"),
  prettier: v("prettier"),
};

export const IMPORT_MAPS: Record<Framework, Record<string, string>> = {
  react: {
    react: esmUrl("react"),
    "react-dom/": esmUrl("react-dom", "/"),
    "gas-client": GAS_CLIENT_ESM_URL,
  },
  vue: {
    vue: esmUrl("vue"),
    "gas-client": GAS_CLIENT_ESM_URL,
  },
  svelte: {
    svelte: esmUrl("svelte"),
    "svelte/": esmUrl("svelte", "/"),
    "gas-client": GAS_CLIENT_ESM_URL,
  },
  solid: {
    "solid-js": esmUrl("solid-js"),
    "solid-js/": esmUrl("solid-js", "/"),
    "gas-client": GAS_CLIENT_ESM_URL,
  },
};

export const CLIENT_EXTERNALS: Record<Framework, string[]> = {
  react: ["react", "react-dom", "react-dom/client", "gas-client"],
  vue: ["vue", "gas-client"],
  svelte: ["svelte", "svelte/internal", "gas-client"],
  solid: ["solid-js", "solid-js/web", "gas-client"],
};
