import path from "path";
import type { ProjectConfig } from "../types.js";
import { writeFile } from "../utils/fs.js";

const GAS_TYPE_LABEL: Record<string, string> = {
  sheets: "Google Sheets Add-on",
  docs: "Google Docs Add-on",
  forms: "Google Forms Add-on",
  standalone: "Standalone Web App",
};

const FRAMEWORK_LABEL: Record<string, string> = {
  react: "React (TypeScript + SWC)",
  vue: "Vue 3 (TypeScript)",
  svelte: "Svelte 5 (TypeScript)",
  solid: "SolidJS (TypeScript)",
  vanilla: "Vanilla (HTML + CSS + TypeScript)",
};

export async function generateReadme(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const { projectName, addonType, framework, addons, packageManager } = config;
  const pm = packageManager;
  const run = pm === "yarn" ? "yarn" : `${pm} run`;

  const isAddon = addonType !== "standalone";
  const containerType =
    addonType === "sheets"
      ? "Spreadsheet"
      : addonType === "docs"
        ? "Document"
        : "Form";

  const addonLines = addons.length
    ? addons
        .map((a) => {
          if (a === "tailwind") return "- **Tailwind CSS v4** — utility-first CSS";
          if (a === "shadcn") return "- **shadcn/ui** — accessible component library";
          if (a === "eslint") return "- **ESLint** — flat config with TypeScript + framework rules";
          if (a === "commitlint") return "- **Commitlint + Lefthook** — conventional commits enforcement";
          return `- ${a}`;
        })
        .join("\n")
    : "- None";

  const openCmd = isAddon
    ? `${run} clasp:open:container  # Open the ${containerType}`
    : `${run} clasp:open:script     # Open Apps Script editor`;

  const clasp_create_hint = isAddon
    ? `${run} clasp:create  # Follow prompts, choose --type ${addonType}`
    : `${run} clasp:create  # Follow prompts, choose --type standalone`;

  const content = `# ${projectName}

> A Google Apps Script project scaffolded with [create-gas-app](https://github.com/vazhioli/create-gas-app).

## Stack

| | |
|---|---|
| **GAS Type** | ${GAS_TYPE_LABEL[addonType]} |
| **Framework** | ${FRAMEWORK_LABEL[framework]} |
| **Addons** | ${addons.length ? addons.join(", ") : "none"} |
| **Package manager** | ${pm} |

### Addons

${addonLines}

---

## Project structure

\`\`\`
${projectName}/
├── apps/
│   └── ${projectName}/
│       └── dialogs/
│           ├── sidebar/          # Main sidebar UI
│           │   ├── index.html
│           │   └── src/
│           │       ├── main.${framework === "vue" || framework === "svelte" ? "ts" : "tsx"}
│           │       └── App.${framework === "vue" ? "vue" : framework === "svelte" ? "svelte" : framework === "solid" ? "tsx" : "tsx"}
${isAddon ? `│           └── about/            # About modal dialog\n│               ├── index.html\n│               └── src/\n` : ""}├── packages/
│   ├── server/                   # GAS server-side code
│   │   └── src/
│   │       ├── index.ts          # Exported server functions
│   │       ├── ui.ts             # Menu builder + dialog openers
│   │       └── env.ts            # Server secrets (gitignored)
│   ├── shared/                   # Shared utilities
│   │   └── src/
│   │       ├── utils/
│   │       │   ├── server.ts     # Type-safe serverFunctions proxy
│   │       │   └── utils.ts      # cn() helper
│   │       └── styles/
│   │           └── global.css
│   └── ui/                       # Shared component library
│       └── src/
│           └── components/
├── vite.config.ts
├── appsscript.json
├── tsconfig.json
└── package.json
\`\`\`

---

## Getting started

### 1. Authenticate with Google

\`\`\`bash
${run} clasp:login
\`\`\`

### 2. Create and link your GAS project

\`\`\`bash
${clasp_create_hint}
\`\`\`

This writes a \`.clasp.json\` file with your script ID.

### 3. Build and deploy

\`\`\`bash
${run} deploy
\`\`\`

### 4. Open the project

\`\`\`bash
${openCmd}
\`\`\`

${isAddon ? `Trigger the add-on from **Extensions → ${projectName}** inside the ${containerType}.` : "Visit the deployed web app URL shown in the Apps Script editor."}

---

## Development (live reload)

> Requires [mkcert](https://github.com/FiloSottile/mkcert) for local HTTPS.

\`\`\`bash
# One-time cert setup
${run} setup:certs

# Start dev server (builds dev wrappers + pushes to GAS + starts Vite)
${run} dev
\`\`\`

The sidebar loads from \`https://localhost:3000\` with hot module replacement.

---

## Scripts

| Script | Description |
|---|---|
| \`${run} dev\` | Build dev wrappers, push to GAS, start Vite dev server |
| \`${run} build\` | Production build — inlined single-file HTML |
| \`${run} deploy\` | Production build + \`clasp push\` |
| \`${run} clasp:login\` | Authenticate with Google |
| \`${run} clasp:create\` | Create and link a GAS project |
| \`${run} clasp:push\` | Push \`dist/\` to GAS |
| \`${run} clasp:open:script\` | Open Apps Script editor |
${isAddon ? `| \`${run} clasp:open:container\` | Open linked ${containerType} |` : ""}| \`${run} setup:certs\` | Generate local HTTPS certs with mkcert |
| \`${run} format\` | Format all files with Prettier |
${addons.includes("eslint") ? `| \`${run} lint\` | Run ESLint |\n| \`${run} lint:fix\` | Auto-fix ESLint issues |` : ""}

---

## Adding dialogs

\`\`\`bash
npx create-gas-app add dialog <name>
\`\`\`

## Adding addons later

\`\`\`bash
npx create-gas-app add addon tailwind
npx create-gas-app add addon eslint
npx create-gas-app add addon commitlint
npx create-gas-app add addon shadcn   # React only
\`\`\`

---

## Server functions

Export functions from \`packages/server/src/index.ts\` and call them on the client with full type inference:

\`\`\`ts
// packages/server/src/index.ts
export const greet = (name: string) => \`Hello, \${name}!\`;
\`\`\`

\`\`\`ts
// client
import { serverFunctions } from "@${projectName}/shared/utils/server";
const msg = await serverFunctions.greet("World");
\`\`\`

---

## Environment secrets

Put server-only secrets in \`packages/server/src/env.ts\` (gitignored):

\`\`\`ts
export const API_KEY = "your-secret-key";
\`\`\`

---

Scaffolded with [create-gas-app](https://github.com/vazhioli/create-gas-app).
`;

  await writeFile(path.join(root, "README.md"), content);
}
