# create-gas-app

The modern CLI to scaffold Google Apps Script add-ons and standalone scripts — with your framework of choice.

```bash
npx create-gas-app@latest
# or
npx create-gas-app@latest my-gas-app
```

---

## Features

- **Multi-framework** — React (SWC), Vue 3, Svelte 5, SolidJS, all with TypeScript
- **All GAS project types** — Sheets Add-on, Docs Add-on, Forms Add-on, Standalone Script
- **Type-safe server bridge** — [gas-client](https://github.com/enuchi/gas-client) wired up with full TypeScript inference from your server functions
- **Dev server with live reload** — Vite + HTTPS iframe bridge for instant feedback inside GAS dialogs
- **Addons** — Tailwind CSS v4, shadcn/ui, Commitlint + Lefthook
- **`add dialog`** — add new dialog entrypoints to an existing project
- **Zero runtime dependency** — generated code is plain files, no `create-gas-app` lock-in

---

## Usage

```bash
# Interactive (recommended)
npx create-gas-app@latest

# With a project name
npx create-gas-app@latest my-sheets-addon

# Add a dialog to an existing project
npx create-gas-app add dialog settings
```

### Interactive prompts

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
  ○ Vue 3
  ○ Svelte 5
  ○ SolidJS

  Select addons:
  ◼ Tailwind CSS v4
  ◼ shadcn/ui
  ◻ Commitlint + Lefthook

  Which package manager?
  ● bun   ○ pnpm   ○ npm   ○ yarn

  Install dependencies now?  Yes
  Initialize a git repository? Yes
```

---

## How it works

```
Google Sheets / Docs / Forms
  └── GAS runtime
       ├── code.js          ← Vite bundles packages/server → IIFE
       └── sidebar.html     ← Vite bundles each dialog → single inlined HTML
            └── React / Vue / Svelte / SolidJS app
                 └── gas-client  ←→  google.script.run  ←→  server functions
```

### Dev mode bridge

GAS only allows iframes from HTTPS origins. During development, `clasp push` deploys a lightweight wrapper HTML that iframes your local Vite dev server. A postMessage bridge proxies `google.script.run` calls to the real GAS backend so you get live reload without a full redeploy.

```
[GAS dialog]
  └── dev-dialog-bridge.html
       └── <iframe src="https://localhost:3000/sidebar/index.html">
                └── Your Vite app
                     └── serverFunctions.getGreeting()
                              │  postMessage
                     dev-wrapper bridges ──→ google.script.run.getGreeting()
```

Client dialogs are built as ESM (`rollup output.format: "es"`) and loaded via an `importmap` in each dialog `index.html` to externalize framework libraries and `gas-client`.

---

## Generated project structure

```
my-gas-app/
├── apps/
│   └── my-gas-app/
│       ├── package.json
│       ├── env.ts
│       └── dialogs/
│           ├── sidebar/
│           │   ├── index.html
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
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── env.ts
│   │   │   └── ui.ts
│   │   └── templates/
│   │       └── dev-dialog-bridge.html
│   ├── shared/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── utils.ts
│   │       ├── utils/server.ts
│   │       └── styles/global.css
│   └── ui/
│       └── src/
│           └── index.ts
├── dist/                         ← Built output (pushed to GAS via clasp)
├── vite.config.ts
├── appsscript.json               ← GAS manifest
├── .clasp.json                   ← Created by `npm run clasp:create`
├── package.json
└── tsconfig.json
```

---

## Getting started with a generated project

### 1. Connect to Google Apps Script

```bash
# Login to your Google account
npx clasp login

# Create and link a new GAS project
npm run clasp:create
```

### 2. Build and deploy

```bash
npm run deploy
```

### 3. Open Apps Script

```bash
# Add-on projects (Sheets/Docs/Forms)
npm run clasp:open-container

# Standalone projects
npm run clasp:open:script
```

### 4. (Optional) Local dev server

```bash
# Requires mkcert pre-installed: https://github.com/FiloSottile/mkcert
npm run setup:certs
npm run dev

# Open your Google Sheet → Extensions → My GAS App → Open
# Edits in apps/my-gas-app/dialogs/* hot-reload instantly
```

---

## Type-safe server calls

Server functions in `packages/server/src/index.ts` are automatically typed on the client:

```typescript
// packages/server/src/index.ts
export const getUserData = async (
  userId: string,
): Promise<{ name: string; plan: string }> => {
  // runs in GAS
  const data = PropertiesService.getUserProperties().getProperty(userId);
  return JSON.parse(data ?? "{}");
};
```

```typescript
// apps/my-gas-app/dialogs/sidebar/src/App.tsx
import { serverFunctions } from "@my-gas-app/shared/utils/server";

// Fully typed — TypeScript knows the return type is { name: string; plan: string }
const data = await serverFunctions.getUserData("user-123");
console.log(data.name); // ✓
console.log(data.typo); // ✗ TypeScript error
```

---

## Adding dialogs

```bash
# Add a new modal dialog
npx create-gas-app add dialog settings
```

Then register it in `vite.config.ts`:

```typescript
const entrypoints = [
  {
    name: "Sidebar",
    filename: "sidebar",
    appDir: "sidebar",
    template: "index.html",
  },
  {
    name: "Settings",
    filename: "settings",
    appDir: "settings",
    template: "index.html",
  }, // added
];
```

And add an opener in `packages/server/src/ui.ts`:

```typescript
export const openSettingsDialog = () => {
  const html = HtmlService.createHtmlOutputFromFile("settings")
    .setWidth(800)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, "Settings");
};
```

Export it from `packages/server/src/index.ts`:

```typescript
export { onOpen, onInstall, openSidebar, openSettingsDialog } from "./ui";
```

---

## Frameworks

| Framework | Plugin                         | Entry file                |
| --------- | ------------------------------ | ------------------------- |
| React     | `@vitejs/plugin-react-swc`     | `index.tsx`               |
| Vue 3     | `@vitejs/plugin-vue`           | `index.ts` + `App.vue`    |
| Svelte 5  | `@sveltejs/vite-plugin-svelte` | `index.ts` + `App.svelte` |
| SolidJS   | `vite-plugin-solid`            | `index.tsx`               |

---

## Addons

### Tailwind CSS v4

Uses the new CSS-first Tailwind v4 with `@tailwindcss/vite`. No `tailwind.config.js` needed.

### shadcn/ui

Generates `components.json` and a starter `Button` component. Add more components with:

```bash
npx shadcn add card
npx shadcn add dialog
```

Only available with React (shadcn/ui's official support).

### Commitlint + Lefthook

Enforces [Conventional Commits](https://www.conventionalcommits.org/) via `@commitlint/config-conventional` and runs `prettier` on staged files via `lefthook`.

---

## Scripts reference

| Script         | Description                                     |
| -------------- | ----------------------------------------------- |
| `dev`          | Run `deploy:dev`, then start Vite dev server (HTTPS localhost:`$PORT`, default `3000`) |
| `build`        | Production build → `dist/`                      |
| `build:dev`    | Dev build (iframe wrappers) → `dist/` using `PORT` (default `3000`) |
| `deploy`       | `build` + `clasp:push`                          |
| `deploy:dev`   | `build:dev` + `clasp:push`                      |
| `clasp:login`  | Authenticate with Google                        |
| `clasp:create` | Create a new GAS project                        |
| `clasp:push`   | Push `dist/` to GAS                             |
| `clasp:open:script` | Open Apps Script project in browser        |
| `clasp:open:container` | Open linked container file (Sheets/Docs/Forms) |
| `setup:certs`  | Generate local HTTPS certs with mkcert          |
| `format`       | Format all files with Prettier                  |

You can override the dev port per command:

```bash
PORT=5173 bun run dev
```

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/vazhioli/create-gas-app
cd create-gas-app
bun install
bun run dev      # watch mode
bun test-scaffold.ts  # run integration tests
```

## License

MIT
