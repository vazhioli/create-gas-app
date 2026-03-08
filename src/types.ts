export type Framework = "react" | "vue" | "svelte" | "solid";
export type GasAddonType = "sheets" | "docs" | "forms" | "standalone";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type Addon = "tailwind" | "shadcn" | "commitlint" | "eslint";

export interface ProjectConfig {
  projectName: string;
  addonType: GasAddonType;
  framework: Framework;
  addons: Addon[];
  packageManager: PackageManager;
  installDeps: boolean;
  initGit: boolean;
}

export interface EntrypointConfig {
  name: string;       // Display name: "Sidebar"
  filename: string;   // Output filename: "sidebar"
  template: string;   // Template path: "sidebar/index.html"
  type: "sidebar" | "dialog";
  width?: number;
  height?: number;
}
