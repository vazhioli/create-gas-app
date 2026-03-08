# create-gas-app

The modern CLI to build Google Apps Script add-ons with React, Vue, Svelte, or SolidJS.

Write real TypeScript, get live reload inside GAS dialogs, call server functions with full type inference — then ship everything as the two files GAS actually understands.

```bash
npx create-gas-app@latest
# or
npx create-gas-app@latest my-sheets-addon
```

---

## Create a project

Running the CLI starts an interactive prompt:

```
  create-gas-app — Google Apps Script, your way

  What is your project named?
  › my-sheets-addon

  What type of Google Apps Script project?
  ● Sheets Add-on
  ○ Docs Add-on
  ○ Forms Add-on
  ○ Standalone Script

  Which frontend framework?
  ● React (TypeScript + SWC)
  ○ Vue 3
  ○ Svelte 5
  ○ SolidJS

  Select addons:
  ◼ Tailwind CSS v4
  ◼ shadcn/ui
  ◻ Commitlint + Lefthook
  ◻ ESLint

  Which package manager?
  ● bun   ○ pnpm   ○ npm   ○ yarn

  Install dependencies now?  Yes
  Initialize a git repository? Yes
```

---

## Sheets Add-on

A Sheets add-on appears in the **Extensions** menu and opens sidebars and dialogs inside Google Sheets. This is the most feature-complete project type.

### Generated structure

```
my-sheets-addon/
├── apps/
│   └── my-sheets-addon/
│       ├── env.ts                    ← Runtime env (sheet ID, named ranges, etc.) — gitignored
│       └── dialogs/
│           ├── sidebar/
│           │   ├── index.html        ← importmap + entry script (no bundled deps)
│           │   └── src/
│           │       ├── main.tsx
│           │       └── App.tsx
│           └── about/
│               ├── index.html
│               └── src/
│                   ├── main.tsx
│                   └── App.tsx
├── packages/
│   ├── server/
│   │   └── src/
│   │       ├── index.ts              ← Export server functions here → auto-typed on client
│   │       ├── ui.ts                 ← onOpen(), openSidebar(), openAboutDialog()
│   │       └── env.ts                ← Server-side secrets — gitignored
│   ├── shared/
│   │   └── src/
│   │       ├── utils/server.ts       ← Typed serverFunctions proxy
│   │       └── styles/global.css     ← Global styles shared by all dialogs
│   └── ui/
│       └── src/
│           └── index.ts              ← Shared component library
├── vite.config.ts
├── appsscript.json                   ← GAS manifest with OAuth scopes
└── package.json                      ← Workspaces + all scripts
```

### Step 1 — Connect to Google

Authenticate once with your Google account:

```bash
npx clasp login
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

This pushes lightweight iframe wrappers to GAS, then starts Vite at `https://localhost:3000`. Open your Google Sheet → **Extensions → My Sheets Addon → Open** — the sidebar loads your local Vite app with full hot reload.

`google.script.run` calls are proxied through a postMessage bridge so real server functions execute in GAS while your UI hot-reloads locally.

### Step 4 — Deploy

```bash
npm run deploy
```

Builds all dialogs to single inlined HTML files, builds the server to a single IIFE, and pushes to GAS.

---

### Type-safe server calls

Define functions in `packages/server/src/index.ts`:

```typescript
// packages/server/src/index.ts
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
// apps/my-sheets-addon/dialogs/sidebar/src/App.tsx
import { serverFunctions } from "@my-sheets-addon/shared/utils/server";

// TypeScript knows the return type: { headers: string[], rows: string[][] }
const { headers, rows } = await serverFunctions.getSheetData("Responses");

// Type error caught at compile time — no silent runtime surprises
console.log(rows.typo); // ✗ Property 'typo' does not exist
```

The `serverFunctions` proxy in `packages/shared/src/utils/server.ts` imports the server's TypeScript types directly via the `@my-sheets-addon/server` workspace alias. GAS globals (`SpreadsheetApp`, `HtmlService`, etc.) are scoped to `packages/server` only and won't leak into your client dialogs.

---

### Adding a dialog

Generate a new dialog entrypoint:

```bash
npx create-gas-app add dialog settings
```

**Register it in `vite.config.ts`:**

```typescript
const entrypoints = [
  { name: "Sidebar",  filename: "sidebar",  appDir: "sidebar",  template: "index.html" },
  { name: "Settings", filename: "settings", appDir: "settings", template: "index.html" }, // ← add
];
```

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

### Adding fonts

The easiest way is Google Fonts. Each dialog's `index.html` already includes preconnect links; add your font there:

```html
<!-- apps/my-sheets-addon/dialogs/sidebar/index.html -->
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
  />
</head>
```

Then use it in `packages/shared/src/styles/global.css`:

```css
body {
  font-family: 'Inter', sans-serif;
}
```

If you're using **Tailwind**, set it as the default sans font in your CSS:

```css
@theme inline {
  --font-sans: 'Inter', sans-serif;
}
```

For **self-hosted fonts** (no external requests at runtime), drop the font files in `packages/shared/src/styles/fonts/` and use `@font-face` in `global.css`. Vite will inline them into the final HTML at build time since dialogs build with `vite-plugin-singlefile`.

---

### Keeping bundles small

Each dialog builds as a **single inlined HTML file**. GAS has no hard file size limit for HTML output, but large bundles slow down dialog load time. The scaffolded project already externalizes your framework (React, Vue, etc.) and `gas-client` via an `importmap` — they load from esm.sh at runtime and are never bundled.

If you add a heavy library, externalize it the same way.

**Step 1 — Add to the importmap in `index.html`:**

```html
<!-- apps/my-sheets-addon/dialogs/sidebar/index.html -->
<script type="importmap">
  {
    "imports": {
      "react":          "https://esm.sh/react@19.2.4",
      "react-dom/":     "https://esm.sh/react-dom@19.2.4/",
      "gas-client":     "https://esm.sh/gas-client@1.2.1",
      "recharts":       "https://esm.sh/recharts@2.15.3"
    }
  }
</script>
```

**Step 2 — Mark it as external in `vite.config.ts`:**

```typescript
// vite.config.ts
rollupOptions: {
  external: ["react", "react-dom", "react-dom/client", "gas-client", "recharts"],
  output: { format: "es" },
}
```

Now `recharts` is fetched from esm.sh by the browser — it's never inlined into your HTML. The importmap entry pins the exact version, so you get reproducible loads.

> **Tip:** Check if the library is available on esm.sh before externalizing. Most npm packages work; native addons or Node-specific packages won't.

---

## Docs Add-on

*Coming soon.*

---

## Forms Add-on

*Coming soon.*

---

## Standalone Script

*Coming soon.*

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

For `tailwind`, the command also prints the exact lines to add to `vite.config.ts` since that file may have been edited.

> **Note:** `shadcn` requires React and Tailwind to be installed first.

---

## Scripts reference

| Script                 | What it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `dev`                  | `deploy:dev` + Vite dev server at `https://localhost:$PORT` |
| `build`                | Production build → inlined HTML in `dist/`                  |
| `build:dev`            | Dev build (iframe wrappers) → `dist/`                       |
| `deploy`               | `build` + `clasp:push`                                      |
| `deploy:dev`           | `build:dev` + `clasp:push`                                  |
| `setup:certs`          | Generate local HTTPS certs with mkcert                      |
| `clasp:create`         | Create a new GAS project and write `.clasp.json`            |
| `clasp:push`           | Push `dist/` to GAS                                         |
| `clasp:open:script`    | Open the Apps Script editor in your browser                 |
| `clasp:open:container` | Open the linked Sheets/Docs/Forms file                      |
| `format`               | Format all files with Prettier                              |
| `lint`                 | Run ESLint (only if ESLint addon was selected)              |
| `lint:fix`             | Run ESLint with auto-fix                                    |

Override the dev port:

```bash
PORT=5173 npm run dev
```

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
