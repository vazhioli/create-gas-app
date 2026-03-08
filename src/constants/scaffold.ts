import type { Framework } from "../types.js";

export const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, Arial, Roboto, 'Helvetica Neue', sans-serif";

export const FRAMEWORK_DEPS: Record<
  Framework,
  {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  }
> = {
  react: {
    dependencies: { react: "^19.2.4", "react-dom": "^19.2.4" },
    devDependencies: {
      "@vitejs/plugin-react-swc": "^4.2.2",
      "@types/react": "^19.2.14",
      "@types/react-dom": "^19.2.3",
    },
  },
  vue: {
    dependencies: { vue: "^3.5.0" },
    devDependencies: { "@vitejs/plugin-vue": "^5.2.0", "vue-tsc": "^2.0.0" },
  },
  svelte: {
    dependencies: { svelte: "^5.0.0" },
    devDependencies: {
      "@sveltejs/vite-plugin-svelte": "^4.0.0",
      "svelte-check": "^4.0.0",
    },
  },
  solid: {
    dependencies: { "solid-js": "^1.9.0" },
    devDependencies: { "vite-plugin-solid": "^2.11.0" },
  },
};

export const ADDON_DEPS = {
  tailwind: {
    dev: {
      tailwindcss: "^4.1.18",
      "@tailwindcss/vite": "^4.1.18",
    },
    prod: {} as Record<string, string>,
  },
  shadcn: {
    dev: { shadcn: "^4.0.1" },
    prod: {
      "class-variance-authority": "^0.7.1",
      clsx: "^2.1.1",
      "tailwind-merge": "^3.5.0",
      "tw-animate-css": "^1.4.0",
      "radix-ui": "^1.4.3",
      "lucide-react": "^0.577.0",
    },
  },
  commitlint: {
    dev: {
      lefthook: "^2.1.1",
      "@commitlint/cli": "^20.4.2",
      "@commitlint/config-conventional": "^20.4.2",
      "lint-staged": "^16.2.7",
    },
    prod: {} as Record<string, string>,
  },
} as const;

export const ROOT_DEV_DEPENDENCIES: Record<string, string> = {
  "@google/clasp": "^3.2.0",
  "gas-types-detailed": "^1.1.3",
  "cross-env": "^10.1.0",
  rimraf: "^6.1.3",
  typescript: "^5.9.3",
  vite: "^7.3.1",
  "vite-plugin-singlefile": "^2.3.0",
  "vite-plugin-static-copy": "^3.2.0",
  prettier: "^3.8.1",
};

export const IMPORT_MAPS: Record<Framework, Record<string, string>> = {
  react: {
    react: "https://esm.sh/react@19.2.4",
    "react-dom/": "https://esm.sh/react-dom@19.2.4/",
    "gas-client": "https://esm.sh/gas-client@1.2.1",
  },
  vue: {
    vue: "https://esm.sh/vue@3.5.0",
    "gas-client": "https://esm.sh/gas-client@1.2.1",
  },
  svelte: {
    svelte: "https://esm.sh/svelte@5.0.0",
    "svelte/": "https://esm.sh/svelte@5.0.0/",
    "gas-client": "https://esm.sh/gas-client@1.2.1",
  },
  solid: {
    "solid-js": "https://esm.sh/solid-js@1.9.0",
    "solid-js/": "https://esm.sh/solid-js@1.9.0/",
    "gas-client": "https://esm.sh/gas-client@1.2.1",
  },
};

export const CLIENT_EXTERNALS: Record<Framework, string[]> = {
  react: ["react", "react-dom", "react-dom/client", "gas-client"],
  vue: ["vue", "gas-client"],
  svelte: ["svelte", "svelte/internal", "gas-client"],
  solid: ["solid-js", "solid-js/web", "gas-client"],
};
