import type { GasAddonType, ProjectConfig } from "../types.js";
import { hasTailwind } from "../types.js";
import { writeFile, projectPath } from "../utils/fs.js";
import { APP_SERVICE } from "../constants/scaffold.js";

// ─── packages/server/src/index.ts ────────────────────────────────────────────

const serverIndexTs = (addonType: GasAddonType) => {
  const uiExports =
    addonType === "standalone"
      ? `export { doGet, doPost } from "./ui";`
      : `export { onOpen, onInstall, openSidebar, openAboutDialog } from "./ui";`;

  const containerFn =
    addonType === "sheets"
      ? `
/** Returns active spreadsheet metadata. */
export const getSpreadsheetInfo = (): { id: string; name: string; activeSheet: string; rowCount: number } => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  return { id: ss.getId(), name: ss.getName(), activeSheet: sheet.getName(), rowCount: sheet.getLastRow() };
};

/**
 * Returns headers and the first N rows of data from a sheet.
 * If sheetName is omitted, reads the active sheet.
 *
 * Usage: const { headers, rows } = await serverFunctions.getSheetData(undefined, 20);
 */
export const getSheetData = (
  sheetName?: string,
  maxRows = 20,
): { headers: string[]; rows: string[][] } => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetName ? ss.getSheetByName(sheetName) ?? ss.getActiveSheet() : ss.getActiveSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = values;
  return { headers: headers.map(String), rows: rows.slice(0, maxRows).map((r) => r.map(String)) };
};`
      : addonType === "docs"
        ? `
/** Returns active document metadata. */
export const getDocumentInfo = (): { id: string; name: string } => {
  const doc = DocumentApp.getActiveDocument();
  return { id: doc.getId(), name: doc.getName() };
};`
        : addonType === "forms"
          ? `
/** Returns active form metadata. */
export const getFormInfo = (): { id: string; title: string } => {
  const form = FormApp.getActiveForm();
  return { id: form.getId(), title: form.getTitle() };
};`
          : "";

  return `// All functions exported here are callable from the client via gas-client.
// Rule: only export what the frontend needs. Keep internal logic un-exported.

${uiExports}

// ─── Context ─────────────────────────────────────────────────────────────────

/** Returns the current authenticated user's email. */
export const getCurrentUser = (): { email: string } => ({
  email: Session.getActiveUser().getEmail(),
});
${containerFn}
// ─── Example server functions ─────────────────────────────────────────────────

/**
 * Returns a greeting string. Demonstrates a simple type-safe server call:
 *   const msg = await serverFunctions.getGreeting("World");
 */
export const getGreeting = (name: string): string => {
  return \`Hello from Google Apps Script, \${name}!\`;
};

/**
 * Read a value from PropertiesService.
 */
export const getUserProperty = (key: string): string | null => {
  return PropertiesService.getUserProperties().getProperty(key);
};

/**
 * Write a value to PropertiesService.
 */
export const setUserProperty = (key: string, value: string): void => {
  PropertiesService.getUserProperties().setProperty(key, value);
};
`;
};

// ─── packages/server/src/ui.ts ───────────────────────────────────────────────

const serverUiTs = (addonType: GasAddonType) => {
  if (addonType === "standalone") {
    return `// Standalone — expose as a Web App via Deploy > New deployment
// https://developers.google.com/apps-script/guides/web

export const doGet = (_e: GoogleAppsScript.Events.DoGet) => {
  return HtmlService.createHtmlOutputFromFile("sidebar").setTitle("My GAS App");
};

export const doPost = (_e: GoogleAppsScript.Events.DoPost) => {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
};
`;
  }

  const appService = APP_SERVICE[addonType];

  return `// HtmlService — opens sidebars and dialogs from the GAS add-on menu.
// These run server-side only; they are NOT called directly by the client.

export const onOpen = () => {
  ${appService}.getUi()
    .createAddonMenu()
    .addItem("Open", "openSidebar")
    .addToUi();
};

export const onInstall = () => {
  onOpen();
};

export const openSidebar = () => {
  ${appService}.getUi().showSidebar(
    HtmlService.createHtmlOutputFromFile("sidebar").setTitle("My GAS App"),
  );
};

export const openAboutDialog = () => {
  ${appService}.getUi().showModalDialog(
    HtmlService.createHtmlOutputFromFile("about").setWidth(480).setHeight(300),
    "About",
  );
};

// ─── Add more openers below as you add dialogs ────────────────────────────────

// export const openSettingsDialog = () => {
//   ${appService}.getUi().showModalDialog(
//     HtmlService.createHtmlOutputFromFile("settings").setWidth(800).setHeight(500),
//     "Settings",
//   );
// };
`;
};

// ─── packages/shared/src/utils/server.ts ─────────────────────────────────────

const sharedUtilsServerTs = (projectName: string) =>
  `import { GASClient } from "gas-client";
// Type-only import — erased at build time, never bundled into the client.
// Gives full TypeScript inference for all server function signatures.
import type * as ServerFunctions from "@${projectName}/server";

/**
 * Type-safe proxy for google.script.run.
 *
 * Production (GAS):   calls google.script.run directly
 * Development (Vite): uses postMessage to the GAS dev wrapper
 *
 * Usage:
 *   import { serverFunctions } from "@${projectName}/shared/utils/server";
 *   const user = await serverFunctions.getCurrentUser();
 */
const { serverFunctions, scriptHostFunctions } = new GASClient<
  typeof ServerFunctions
>({
  allowedDevelopmentDomains: (origin) =>
    /https:\\/\\/.+\\.googleusercontent\\.com$/.test(origin),
});

export { serverFunctions, scriptHostFunctions };
`;

// ─── packages/shared/src/utils.ts ────────────────────────────────────────────

const sharedUtilsTs = (hasTailwind: boolean) =>
  hasTailwind
    ? `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names without conflicts (used by shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`
    : `/** Combine class names, filtering falsy values. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
`;

// ─── packages/shared/src/index.ts barrel ─────────────────────────────────────

const sharedIndexTs = () => `export * from "./utils.js";
`;

// ─── packages/ui/src/index.ts barrel ─────────────────────────────────────────

const uiIndexTs = () => `// Re-export all shared UI components
// e.g. export { Button } from "./components/button.js";
`;

const serverEnvTs = () => `/**
 * Server-only environment values.
 * Do not expose these values to client bundles.
 */
export const env = {
  SOME_PRIVATE_KEY: "",
};
`;

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateServer(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const pp = (...s: string[]) => projectPath(root, ...s);
  const tw = hasTailwind(config.addons);

  // packages/server
  await writeFile(
    pp("packages", "server", "src", "index.ts"),
    serverIndexTs(config.addonType),
  );
  await writeFile(
    pp("packages", "server", "src", "ui.ts"),
    serverUiTs(config.addonType),
  );
  await writeFile(pp("packages", "server", "src", "env.ts"), serverEnvTs());

  // packages/shared
  await writeFile(
    pp("packages", "shared", "src", "utils", "server.ts"),
    sharedUtilsServerTs(config.projectName),
  );
  await writeFile(
    pp("packages", "shared", "src", "utils.ts"),
    sharedUtilsTs(tw),
  );
  await writeFile(pp("packages", "shared", "src", "index.ts"), sharedIndexTs());

  // packages/ui barrel
  await writeFile(pp("packages", "ui", "src", "index.ts"), uiIndexTs());
}
