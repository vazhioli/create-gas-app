# create-gas-app

The modern CLI to build Google Apps Script add-ons with React, Vue, Svelte, SolidJS, or plain HTML + CSS + TypeScript.

Write real TypeScript, get live reload inside GAS dialogs, call server functions with full type inference — then ship everything as the two files GAS actually understands.

```bash
npx create-gas-app@latest
# or
npx create-gas-app@latest my-sheets-addon
```

---

## Prerequisites

- **Node.js ≥ 18**
- **mkcert** *(optional, for local dev server)* — generates trusted local HTTPS certs. [Install instructions](https://github.com/FiloSottile/mkcert#installation)

---

## Create a project

Running the CLI starts an interactive prompt:

```
  create-gas-app — Google Apps Script, your way

  What is your project named?
  › my-gas-app

  What type of Google Apps Script project?
  ● Sheets Add-on
  ○ Docs Add-on
  ○ Forms Add-on
  ○ Standalone Script

  Which frontend framework?
  ● React (TypeScript + SWC)
  ○ Vue (Vue 3 + TypeScript)
  ○ Svelte (Svelte 5 + TypeScript)
  ○ SolidJS (SolidJS + TypeScript)
  ○ Vanilla (Plain HTML + CSS + TypeScript, no framework)

  Select addons (space to toggle, enter to confirm):
  ◼ Tailwind CSS v4
  ◼ shadcn/ui          ← only shown when React is selected
  ◻ Commitlint + Lefthook
  ◻ ESLint

  Which package manager?
  ● bun (detected)   ○ pnpm   ○ npm   ○ yarn

  Setup options:
  ◼ Install dependencies
  ◼ Initialize git repository
```

The package manager prompt pre-selects whichever manager was used to run the CLI (detected from lockfiles or `npm_config_user_agent`).

> **Note:** All command examples below use `npm run`. Substitute `bun run`, `pnpm run`, or `yarn` depending on what you chose at scaffold time.

---

## Getting started

All project types share the same Vite monorepo structure and the same workflow. Pick your project type during scaffolding — the rest is identical.

### Generated structure

```
my-gas-app/
├── .vscode/
│   └── settings.json             ← IDE settings (Prettier, Tailwind, TypeScript)
├── apps/
│   └── my-gas-app/
│       ├── env.ts                ← Runtime env — gitignored
│       ├── env.example.ts        ← Template for env.ts (committed)
│       └── dialogs/
│           ├── sidebar/
│           │   ├── index.html    ← importmap + entry script (no bundled deps)
│           │   └── src/
│           │       ├── main.ts(x)
│           │       └── App.ts(x)
│           └── about/
│               ├── index.html
│               └── src/
│                   ├── main.ts(x)
│                   └── App.ts(x)
├── packages/
│   ├── server/
│   │   └── src/
│   │       ├── index.ts          ← Export server functions here → auto-typed on client
│   │       ├── ui.ts             ← onOpen(), openSidebar(), openAboutDialog()
│   │       └── env.ts            ← Server-side secrets — gitignored
│   ├── shared/
│   │   └── src/
│   │       ├── utils/server.ts   ← Typed serverFunctions proxy
│   │       └── styles/global.css ← Global styles shared by all dialogs
│   └── ui/
│       └── src/
│           └── index.ts          ← Shared component library
├── vite.config.ts
├── appsscript.json               ← GAS manifest with OAuth scopes
├── README.md                     ← Project-specific readme with dev workflow
└── package.json                  ← Workspaces + all scripts
```

### Step 1 — Connect to Google

Authenticate once with your Google account:

```bash
npm run clasp:login
```

Then create a new GAS project and link it to your repo:

```bash
npm run clasp:create
```

This writes `.clasp.json` with your script ID. Run it once — all future pushes go to the same project.

To link an **existing** GAS project instead, get the script ID from the Apps Script URL (`https://script.google.com/d/<SCRIPT_ID>/edit`) and create `.clasp.json` manually:

```json
{ "scriptId": "<YOUR_SCRIPT_ID>", "rootDir": "./dist" }
```

### Step 2 — Set up local HTTPS

GAS only allows iframes from HTTPS origins. Generate a trusted local cert once:

```bash
# Requires mkcert: https://github.com/FiloSottile/mkcert
npm run setup:certs
```

### Step 3 — Start the dev server

```bash
npm run dev
```

This pushes lightweight iframe wrappers to GAS, then starts Vite at `https://localhost:3000`. Open your Google Sheet / Doc / Form → **Extensions → My App → Open** — the sidebar loads your local Vite app with full hot reload.

`google.script.run` calls are proxied through a postMessage bridge so real server functions execute in GAS while your UI hot-reloads locally.

### Step 4 — Deploy

```bash
npm run deploy
```

Builds all dialogs to single inlined HTML files, builds the server to a single ES bundle (exports stripped for GAS compatibility), and pushes to GAS.

---

## Frameworks

### React

TypeScript + SWC. Includes JSX transform, React 19, and optionally shadcn/ui.

### Vue

Vue 3 + TypeScript via `@vitejs/plugin-vue`.

### Svelte

Svelte 5 + TypeScript via `@sveltejs/vite-plugin-svelte`.

### SolidJS

SolidJS + TypeScript via `vite-plugin-solid`.

### Vanilla

No framework dependencies. Uses a class-based `App` pattern with raw DOM manipulation and TypeScript. A good choice when bundle size matters most or when you don't need a reactive framework.

```typescript
// apps/my-gas-app/dialogs/sidebar/src/App.ts
export class App {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `<h1>Hello from GAS!</h1>`;
  }
}
```

---

## Project types

All project types share the same structure and workflow. The differences are which GAS service is used server-side and what starter functions are generated.

### Sheets Add-on

Extends Google Sheets. Uses `SpreadsheetApp.getUi()` for the Extensions menu. The generated starter functions:

```typescript
// Returns spreadsheet name, active sheet name, and row count
export const getSpreadsheetInfo = (): {
  id: string; name: string; activeSheet: string; rowCount: number;
} => { ... };

// Returns headers + first N rows of a sheet
export const getSheetData = (sheetName?: string, maxRows = 20): {
  headers: string[]; rows: string[][];
} => { ... };
```

### Docs Add-on

Extends Google Docs. Uses `DocumentApp.getUi()` for the Extensions menu. The generated starter function:

```typescript
export const getDocumentInfo = (): { id: string; name: string } => {
  const doc = DocumentApp.getActiveDocument();
  return { id: doc.getId(), name: doc.getName() };
};
```

### Forms Add-on

Extends the **Google Forms editor** — adds sidebars, dialogs, and menu items to the form editing interface. It does not modify the form that respondents see. Uses `FormApp.getUi()` for the Extensions menu.

The generated starter function:

```typescript
export const getFormInfo = (): { id: string; title: string } => {
  const form = FormApp.getActiveForm();
  return { id: form.getId(), title: form.getTitle() };
};
```

Forms add-ons also support installable triggers. For example, running a function every time a respondent submits the form:

```typescript
export const onFormSubmit = (e: GoogleAppsScript.Events.FormsOnFormSubmit): void => {
  const response = e.response;
  // process response...
};
```

### Standalone Script

A standalone script has no container. It is deployed as a **web app** and responds to HTTP requests via `doGet` and `doPost`. There is no Extensions menu and no `onOpen` trigger.

```typescript
export const doGet = (_e: GoogleAppsScript.Events.DoGet) => {
  return HtmlService.createHtmlOutputFromFile("sidebar").setTitle("My App");
};

export const doPost = (_e: GoogleAppsScript.Events.DoPost) => {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
};
```

Deploy via **Deploy → New deployment → Web app** in the Apps Script editor.

---

## OAuth scopes

Google Apps Script requires explicit OAuth scopes to access Google services. Scopes are declared in `appsscript.json` at the project root:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

Common scopes you may need:

| Scope | When to add it |
| ----- | -------------- |
| `https://www.googleapis.com/auth/script.external_request` | Calling external APIs with `UrlFetchApp` |
| `https://www.googleapis.com/auth/script.scriptapp` | Creating or managing installable triggers |
| `https://www.googleapis.com/auth/script.send_mail` | Sending email on behalf of the user via `MailApp` |
| `https://www.googleapis.com/auth/spreadsheets` | Reading or writing Google Sheets data |
| `https://www.googleapis.com/auth/documents` | Reading or writing Google Docs data |
| `https://www.googleapis.com/auth/forms` | Reading or writing Google Forms data |

### Handling granular OAuth

Google OAuth is granular — users are shown each requested scope individually and may choose to grant only some of them. Use `ScriptApp.requireScopes()` to validate that the user has granted the specific scopes a function needs, or `ScriptApp.requireAllScopes()` if a function depends on every scope declared in `appsscript.json`. Both methods end execution immediately and prompt the user for authorization if any required scope is missing.

```typescript
// Use requireScopes() when a function only needs a subset of your declared scopes.
export const fetchAndLog = () => {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
  ]);

  const response = UrlFetchApp.fetch("https://api.example.com/data");
  const data = JSON.parse(response.getContentText());

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.getRange(sheet.getLastRow() + 1, 1).setValue(data.value);
};

// Use requireAllScopes() when a function relies on every scope in appsscript.json.
export const fullSync = () => {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  // ...
};
```

See the [Google Apps Script scopes documentation](https://developers.google.com/apps-script/concepts/scopes#handle-granular) for the full guide on detecting missing scopes and triggering the authorization popup.

---

## Common patterns

### Type-safe server calls

Define functions in `packages/server/src/index.ts`:

```typescript
export const getSheetData = async (
  sheetName: string,
): Promise<{ headers: string[]; rows: string[][] }> => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const [headers, ...rows] = sheet.getDataRange().getValues();
  return { headers, rows };
};
```

Call them from any dialog with full type inference — no manual type declarations needed:

```typescript
import { serverFunctions } from "@my-gas-app/shared/utils/server";

// TypeScript knows the return type: { headers: string[], rows: string[][] }
const { headers, rows } = await serverFunctions.getSheetData("Responses");

// Type error caught at compile time
console.log(rows.typo); // ✗ Property 'typo' does not exist
```

GAS globals (`SpreadsheetApp`, `HtmlService`, etc.) are scoped to `packages/server` only and won't leak into your client dialogs.

---

### Adding a dialog

Generate a new dialog entrypoint:

```bash
npx create-gas-app add dialog settings
```

This scaffolds the dialog files **and automatically patches `vite.config.ts`** to register the new entrypoint — no manual edits required.

**Add an opener in `packages/server/src/ui.ts`:**

```typescript
export const openSettingsDialog = () => {
  const html = HtmlService.createHtmlOutputFromFile("settings")
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, "Settings");
};
```

**Export it from `packages/server/src/index.ts`:**

```typescript
export { onOpen, onInstall, openSidebar, openSettingsDialog } from "./ui";
```

Now `serverFunctions.openSettingsDialog()` is available — typed — from any dialog.

---

### Customising the Extensions menu

> Standalone scripts do not have an Extensions menu — skip this section if you chose Standalone.

The generated `onOpen` in `packages/server/src/ui.ts` runs every time the file is opened and builds the add-on menu. The UI service differs per project type:

| Project type | UI service |
| ------------ | ---------- |
| Sheets | `SpreadsheetApp.getUi()` |
| Docs | `DocumentApp.getUi()` |
| Forms | `FormApp.getUi()` |

**Add an item that opens a dialog:**

```typescript
export const onOpen = () => {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem("Open", "openSidebar")
    .addItem("Settings", "openSettingsDialog") // ← add
    .addToUi();
};
```

**Add an item that runs a server function directly:**

```typescript
export const onOpen = () => {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem("Open", "openSidebar")
    .addSeparator()
    .addItem("Import data", "importDataFromSheet")
    .addToUi();
};
```

**Add a submenu:**

```typescript
export const onOpen = () => {
  const ui = SpreadsheetApp.getUi();
  ui.createAddonMenu()
    .addItem("Open", "openSidebar")
    .addSeparator()
    .addSubMenu(
      ui.createMenu("Tools")
        .addItem("Import data", "importDataFromSheet")
        .addItem("Export to CSV", "exportToCsv"),
    )
    .addToUi();
};
```

Everything added to the menu must be exported from `packages/server/src/index.ts` so GAS can find it at the top level:

```typescript
export { onOpen, onInstall, openSidebar, openSettingsDialog, importDataFromSheet } from "./ui";
```

> **Tip:** Menu items run as server-side functions — they can read/write data directly without going through `serverFunctions`. Use them for one-shot operations. Use `serverFunctions` when you need to trigger an action from within a dialog.

---

### Adding fonts

Each dialog's `index.html` already includes Google Fonts preconnect links. Add your font:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
/>
```

Then use it in `packages/shared/src/styles/global.css`:

```css
body { font-family: 'Inter', sans-serif; }
```

If you're using **Tailwind**:

```css
@theme inline {
  --font-sans: 'Inter', sans-serif;
}
```

For **self-hosted fonts**, drop the files in `packages/shared/src/styles/fonts/` and use `@font-face` in `global.css`. Vite inlines them into the final HTML at build time via `vite-plugin-singlefile`.

---

### Keeping bundles small

Each dialog builds as a **single inlined HTML file**. The scaffolded project already externalizes your framework and `gas-client` via an `importmap` — they load from esm.sh at runtime and are never bundled.

If you add a heavy library, externalize it the same way.

**Step 1 — Add to the importmap in `index.html`:**

```html
<script type="importmap">
  {
    "imports": {
      "react":      "https://esm.sh/react@19.2.4",
      "react-dom/": "https://esm.sh/react-dom@19.2.4/",
      "gas-client": "https://esm.sh/gas-client@1.2.1",
      "recharts":   "https://esm.sh/recharts@2.15.3"
    }
  }
</script>
```

**Step 2 — Mark it as external in `vite.config.ts`:**

```typescript
rollupOptions: {
  external: ["react", "react-dom", "react-dom/client", "gas-client", "recharts"],
  output: { format: "es" },
}
```

> **Tip:** Check if the library is available on esm.sh before externalizing. Most npm packages work; native addons or Node-specific packages won't.

---

## Addons

### Tailwind CSS v4

CSS-first Tailwind with `@tailwindcss/vite`. No config file needed — just import in CSS and use classes. Global styles live in `packages/shared/src/styles/global.css`.

### shadcn/ui

Generates `components.json` and a starter `Button` component using the unified `radix-ui` package. Add more components:

```bash
npx shadcn add card
npx shadcn add dialog
npx shadcn add data-table
```

Only available with React.

### Commitlint + Lefthook

Enforces [Conventional Commits](https://www.conventionalcommits.org/) with `@commitlint/config-conventional`. Runs Prettier on staged files via `lefthook` before each commit.

### ESLint

Generates `eslint.config.js` with ESLint 9 flat config, TypeScript support, and framework-specific rules:

| Framework | Extra plugins |
| --------- | ------------- |
| React     | `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` |
| Vue       | `eslint-plugin-vue` |
| Svelte    | `eslint-plugin-svelte` |
| SolidJS   | `eslint-plugin-solid` |
| Vanilla   | TypeScript rules only |

Adds `lint` and `lint:fix` scripts to `package.json`.

---

## Adding addons to an existing project

Addons can be added after scaffolding with the `add addon` subcommand:

```bash
npx create-gas-app add addon tailwind
npx create-gas-app add addon eslint
npx create-gas-app add addon commitlint
npx create-gas-app add addon shadcn
```

Run from the project root. The command auto-detects your framework and project name, writes the addon files, and updates `package.json` with the required dependencies. Then install:

```bash
npm install
```

> **Note:** `shadcn` requires React and Tailwind to be installed first.

---

## Scripts reference

> These scripts are available in every **generated project**. They are not part of the `create-gas-app` CLI repo itself.

| Script                 | What it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `dev`                  | `deploy:dev` + Vite dev server at `https://localhost:$PORT` |
| `build`                | Production build → inlined HTML in `dist/`                  |
| `build:dev`            | Dev build (iframe wrappers) → `dist/`                       |
| `deploy`               | `build` + `clasp:push`                                      |
| `deploy:dev`           | `build:dev` + `clasp:push`                                  |
| `setup:certs`          | Generate local HTTPS certs with mkcert                      |
| `clasp:login`          | Authenticate with Google                                    |
| `clasp:create`         | Create a new GAS project and write `.clasp.json`            |
| `clasp:push`           | Push `dist/` to GAS                                         |
| `clasp:open:script`    | Open the Apps Script editor in your browser                 |
| `clasp:open:container` | Open the linked Sheets/Docs/Forms file                      |
| `format`               | Format all files with Prettier                              |
| `type-check`           | Run `tsc --noEmit` across the whole monorepo                |
| `lint`                 | Run ESLint (only if ESLint addon was selected)              |
| `lint:fix`             | Run ESLint with auto-fix                                    |

Override the dev port:

```bash
PORT=5173 npm run dev
```

---

## Resources

- [Google Apps Script — Guides](https://developers.google.com/apps-script/overview) — Concepts, tutorials, and how-to guides
- [Google Apps Script — Reference](https://developers.google.com/apps-script/reference) — Full API reference for all GAS services

---

## Acknowledgements

The Sheets add-on architecture is heavily inspired by [enuchi/React-Google-Apps-Script](https://github.com/enuchi/React-Google-Apps-Script) — the original template that pioneered bundling React apps into GAS dialogs with a Webpack + Babel setup. Two of his packages are core dependencies of every generated project:

- [**gas-client**](https://github.com/enuchi/gas-client) — the promise-based wrapper around `google.script.run` that powers all type-safe server calls
- [**gas-types-detailed**](https://github.com/enuchi/gas-types-detailed) — comprehensive TypeScript type definitions for the entire Google Apps Script API

---

## Contributing

```bash
git clone https://github.com/vazhioli/create-gas-app
cd create-gas-app
bun install
bun run dev           # watch mode — rebuilds on save
bun test-scaffold.ts  # integration tests
```

## License

MIT
