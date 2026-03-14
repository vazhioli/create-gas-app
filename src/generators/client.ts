import type { Framework, GasAddonType, ProjectConfig } from "../types.js";
import { hasTailwind } from "../types.js";
import { writeFile, projectPath } from "../utils/fs.js";
import { FONT_STACK, IMPORT_MAPS } from "../constants/scaffold.js";

// ─── Container context config by addon type ───────────────────────────────────
// Drives state declarations, data-fetch calls, and info display in each App.

interface ContainerSpec {
  fn: string;          // server function name
  stateVar: string;    // local state variable name
  type: string;        // TypeScript type string
  fields: [string, string][]; // [display label, property name] pairs
}

const CONTAINER: Partial<Record<GasAddonType, ContainerSpec>> = {
  sheets: {
    fn: "getSpreadsheetInfo",
    stateVar: "spreadsheet",
    type: "{ id: string; name: string; activeSheet: string; rowCount: number }",
    fields: [["Spreadsheet", "name"], ["Sheet", "activeSheet"], ["Rows", "rowCount"]],
  },
  docs: {
    fn: "getDocumentInfo",
    stateVar: "docInfo",
    type: "{ id: string; name: string }",
    fields: [["Document", "name"]],
  },
  forms: {
    fn: "getFormInfo",
    stateVar: "form",
    type: "{ id: string; title: string }",
    fields: [["Form", "title"]],
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Global CSS ───────────────────────────────────────────────────────────────

const globalCssBase = `/* Global styles */
body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden auto;
  font-family: ${FONT_STACK};
  -webkit-font-smoothing: antialiased;
}
#root { width: 100%; min-height: 100%; }
`;

const globalCssTailwind = `@import "tailwindcss";

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden auto;
  font-family: ${FONT_STACK};
}
#root { @apply w-full min-h-screen; }
`;

// ─── HTML template ────────────────────────────────────────────────────────────

const indexHtml = (title: string, entryFile: string, framework: Framework) =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <script type="importmap">
${JSON.stringify({ imports: IMPORT_MAPS[framework] }, null, 2)}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entryFile}"></script>
  </body>
</html>
`;

const appEnvTs = () => `/**
 * Client-only environment values.
 * Keep this limited to non-secret, public values only.
 */
export const env = {
  API_BASE_URL: "",
};
`;

// ─── REACT ────────────────────────────────────────────────────────────────────

const reactMainTsx = (projectName: string) =>
  `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@${projectName}/shared/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const reactAppTsx = (
  projectName: string,
  hasTailwind: boolean,
  hasShadcn: boolean,
  addonType: GasAddonType,
) => {
  const cs = CONTAINER[addonType] ?? null;
  const isAddon = addonType !== "standalone";
  const uiMode = hasShadcn ? "shadcn" : hasTailwind ? "tailwind" : "inline";
  const importLine = hasShadcn
    ? `import { Button } from "@${projectName}/ui/components/button";`
    : "";

  // State
  const containerState = cs
    ? `\n  const [${cs.stateVar}, set${cap(cs.stateVar)}] = useState<${cs.type} | null>(null);`
    : "";

  // useEffect body
  const effectBody = cs
    ? `Promise.all([
      serverFunctions.getCurrentUser(),
      serverFunctions.${cs.fn}(),
    ]).then(([u, c]) => {
      setUser(u);
      set${cap(cs.stateVar)}(c);
      setLoading(false);
    });`
    : `serverFunctions.getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });`;

  const allRows: [string, string][] = [
    ["User", "user?.email"],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `${cs.stateVar}?.${field}`]) : []),
  ];
  const loadingEl =
    uiMode === "inline"
      ? `<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#94a3b8", fontSize: "13px" }}>Loading workspace…</div>`
      : `<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading workspace…</div>`;

  const infoRowsInline = allRows
    .map(([l, e], i) => {
      const sep = i < allRows.length - 1 ? 'borderBottom: "1px solid #f1f5f9",' : "";
      return `            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", ${sep} gap: "12px" }}><span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", flexShrink: 0 }}>${l}</span><span style={{ fontSize: "13px", fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58%" }}>{${e}}</span></div>`;
    })
    .join("\n");

  const infoRowsTailwind = allRows
    .map(
      ([l, e]) =>
        `            <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"><span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">${l}</span><span className="truncate text-[13px] font-medium text-foreground">{${e}}</span></div>`,
    )
    .join("\n");

  const actionInline = isAddon
    ? `<button onClick={() => serverFunctions.openAboutDialog()} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#334155", padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>About</button>`
    : "";
  const actionTailwind = isAddon
    ? `<button onClick={() => serverFunctions.openAboutDialog()} className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">About</button>`
    : "";
  const actionShadcn = isAddon
    ? `<Button variant="outline" onClick={() => serverFunctions.openAboutDialog()}>About</Button>`
    : "";

  const bodyInline = `<div style={{ minHeight: "100vh", background: "#f8fafc", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <p style={{ margin: "0 0 8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6366f1" }}>● Google Apps Script</p>
        <h1 style={{ margin: 0, fontSize: "21px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.025em", lineHeight: 1.2 }}>My GAS App</h1>
        <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>Type-safe server calls · Live reload · Zero lock-in</p>
      </div>
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
${infoRowsInline}
      </div>${isAddon ? `
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
        ${actionInline}
      </div>` : ""}
    </div>`;

  const bodyTailwind = `<div className="flex min-h-screen flex-col gap-4 p-5">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-500">● Google Apps Script</p>
        <h1 className="text-[21px] font-extrabold tracking-tight text-foreground">My GAS App</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">Type-safe server calls · Live reload · Zero lock-in</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
${infoRowsTailwind}
      </div>${isAddon ? `
      <div className="mt-auto flex justify-end">
        ${uiMode === "tailwind" ? actionTailwind : actionShadcn}
      </div>` : ""}
    </div>`;

  const body = uiMode === "inline" ? bodyInline : bodyTailwind;

  const errorEl =
    uiMode === "inline"
      ? `<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#ef4444", fontSize: "13px", padding: "16px", textAlign: "center" }}>{error}</div>`
      : `<div className="flex min-h-screen items-center justify-center p-4 text-center text-sm text-destructive">{error}</div>`;

  return `import { serverFunctions } from "@${projectName}/shared/utils/server";
import { useEffect, useState } from "react";
${importLine}

export function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);${containerState}

  useEffect(() => {
    ${effectBody.replace(
      /\}\);$/,
      `}).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    });`,
    )}
  }, []);

  if (loading) return ${loadingEl};
  if (error) return ${errorEl};

  return (${body});
}
`;
};

// ─── VUE ─────────────────────────────────────────────────────────────────────

const vueMainTs = (projectName: string) =>
  `import { createApp } from "vue";
import App from "./App.vue";
import "@${projectName}/shared/styles/global.css";

createApp(App).mount("#root");
`;

const vueAppVue = (projectName: string, hasTailwind: boolean, addonType: GasAddonType) => {
  const cs = CONTAINER[addonType] ?? null;
  const isAddon = addonType !== "standalone";

  // State (ref declarations)
  const containerRef = cs ? `\nconst ${cs.stateVar} = ref<${cs.type} | null>(null);` : "";

  // onMounted body
  const mountedBody = cs
    ? `const [u, c] = await Promise.all([
    serverFunctions.getCurrentUser(),
    serverFunctions.${cs.fn}(),
  ]);
  user.value = u;
  ${cs.stateVar}.value = c;
  loading.value = false;`
    : `user.value = await serverFunctions.getCurrentUser();
  loading.value = false;`;

  // Loading + wrapper
  const loadingTmpl = hasTailwind
    ? `<div v-if="loading" class="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading workspace…</div>`
    : `<div v-if="loading" style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #94a3b8; font-size: 13px">Loading workspace…</div>`;
  const wrapper = hasTailwind
    ? `<div v-else class="flex min-h-screen flex-col gap-4 p-5">`
    : `<div v-else style="min-height: 100vh; background: #f8fafc; padding: 20px 16px; display: flex; flex-direction: column; gap: 14px">`;
  const titleEl = hasTailwind
    ? `<div>
    <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-500">● Google Apps Script</p>
    <h1 class="text-[21px] font-extrabold tracking-tight text-foreground">My GAS App</h1>
    <p class="mt-1.5 text-xs text-muted-foreground">Type-safe server calls · Live reload · Zero lock-in</p>
  </div>`
    : `<div>
    <p style="margin: 0 0 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6366f1">● Google Apps Script</p>
    <h1 style="margin: 0; font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; line-height: 1.2">My GAS App</h1>
    <p style="margin: 5px 0 0; font-size: 12px; color: #64748b; line-height: 1.5">Type-safe server calls · Live reload · Zero lock-in</p>
  </div>`;

  // Info rows
  const allRows: [string, string][] = [
    ["User", "user?.email"],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `${cs.stateVar}?.${field}`]) : []),
  ];
  const infoBlock = hasTailwind
    ? `<div class="overflow-hidden rounded-2xl border border-border/60 bg-background">
    ${allRows.map(([l, e], i) => {
      const border = i < allRows.length - 1 ? "border-b border-border/50 " : "";
      return `<div class="${border}flex items-center justify-between gap-3 px-4 py-3"><span class="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">${l}</span><span class="truncate text-[13px] font-medium text-foreground">{{ ${e} }}</span></div>`;
    }).join("\n    ")}
  </div>`
    : `<div style="background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
    ${allRows.map(([l, e], i) => {
      const sep = i < allRows.length - 1 ? "border-bottom: 1px solid #f1f5f9; " : "";
      return `<div style="display: flex; align-items: center; justify-content: space-between; padding: 11px 16px; ${sep}gap: 12px"><span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; flex-shrink: 0">${l}</span><span style="font-size: 13px; font-weight: 500; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 58%">{{ ${e} }}</span></div>`;
    }).join("\n    ")}
  </div>`;

  const aboutBtn = isAddon
    ? hasTailwind
      ? `\n    <div class="mt-auto flex justify-end"><button @click="() => serverFunctions.openAboutDialog()" class="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">About</button></div>`
      : `\n    <div style="margin-top: auto; display: flex; justify-content: flex-end"><button @click="() => serverFunctions.openAboutDialog()" style="border: 1px solid #e2e8f0; background: #fff; color: #334155; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600">About</button></div>`
    : "";

  const errorTmpl = hasTailwind
    ? `<div v-else-if="error" class="flex min-h-screen items-center justify-center p-4 text-center text-sm text-destructive">{{ error }}</div>`
    : `<div v-else-if="error" style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #ef4444; font-size: 13px; padding: 16px; text-align: center">{{ error }}</div>`;

  return `<script setup lang="ts">
import { onMounted, ref } from "vue";
import { serverFunctions } from "@${projectName}/shared/utils/server";

const loading = ref(true);
const error = ref<string | null>(null);
const user = ref<{ email: string } | null>(null);${containerRef}

onMounted(async () => {
  try {
    ${mountedBody}
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Something went wrong.";
    loading.value = false;
  }
});
</script>

<template>
  ${loadingTmpl}
  ${errorTmpl}
  ${wrapper}
    ${titleEl}
    ${infoBlock}${aboutBtn}
  </div>
</template>
`;
};

// ─── SVELTE ───────────────────────────────────────────────────────────────────

const svelteMainTs = (projectName: string) =>
  `import { mount } from "svelte";
import App from "./App.svelte";
import "@${projectName}/shared/styles/global.css";

mount(App, { target: document.getElementById("root")! });
`;

const svelteAppSvelte = (projectName: string, hasTailwind: boolean, addonType: GasAddonType) => {
  const cs = CONTAINER[addonType] ?? null;
  const isAddon = addonType !== "standalone";

  const containerState = cs ? `\n  let ${cs.stateVar} = $state<${cs.type} | null>(null);` : "";

  const mountBody = cs
    ? `const [u, c] = await Promise.all([
      serverFunctions.getCurrentUser(),
      serverFunctions.${cs.fn}(),
    ]);
    user = u;
    ${cs.stateVar} = c;`
    : `user = await serverFunctions.getCurrentUser();`;

  const wrapper = hasTailwind
    ? `<div class="flex min-h-screen flex-col gap-4 p-5">`
    : `<div style="min-height: 100vh; background: #f8fafc; padding: 20px 16px; display: flex; flex-direction: column; gap: 14px">`;
  const titleEl = hasTailwind
    ? `<div>
  <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-500">● Google Apps Script</p>
  <h1 class="text-[21px] font-extrabold tracking-tight text-foreground">My GAS App</h1>
  <p class="mt-1.5 text-xs text-muted-foreground">Type-safe server calls · Live reload · Zero lock-in</p>
</div>`
    : `<div>
  <p style="margin: 0 0 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6366f1">● Google Apps Script</p>
  <h1 style="margin: 0; font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; line-height: 1.2">My GAS App</h1>
  <p style="margin: 5px 0 0; font-size: 12px; color: #64748b; line-height: 1.5">Type-safe server calls · Live reload · Zero lock-in</p>
</div>`;

  const allRows: [string, string][] = [
    ["User", "user?.email"],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `${cs.stateVar}?.${field}`]) : []),
  ];
  const infoBlock = hasTailwind
    ? `<div class="overflow-hidden rounded-2xl border border-border/60 bg-background">
  ${allRows.map(([l, e], i) => {
    const border = i < allRows.length - 1 ? "border-b border-border/50 " : "";
    return `<div class="${border}flex items-center justify-between gap-3 px-4 py-3"><span class="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">${l}</span><span class="truncate text-[13px] font-medium text-foreground">{${e}}</span></div>`;
  }).join("\n  ")}
</div>`
    : `<div style="background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
  ${allRows.map(([l, e], i) => {
    const sep = i < allRows.length - 1 ? "border-bottom: 1px solid #f1f5f9; " : "";
    return `<div style="display: flex; align-items: center; justify-content: space-between; padding: 11px 16px; ${sep}gap: 12px"><span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; flex-shrink: 0">${l}</span><span style="font-size: 13px; font-weight: 500; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 58%">{${e}}</span></div>`;
  }).join("\n  ")}
</div>`;

  const aboutBtn = isAddon
    ? hasTailwind
      ? `\n<div class="mt-auto flex justify-end"><button onclick={() => serverFunctions.openAboutDialog()} class="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">About</button></div>`
      : `\n<div style="margin-top: auto; display: flex; justify-content: flex-end"><button onclick={() => serverFunctions.openAboutDialog()} style="border: 1px solid #e2e8f0; background: #fff; color: #334155; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600">About</button></div>`
    : "";

  const errorEl = hasTailwind
    ? `<div class="flex min-h-screen items-center justify-center p-4 text-center text-sm text-destructive">{error}</div>`
    : `<div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #ef4444; font-size: 13px; padding: 16px; text-align: center">{error}</div>`;

  return `<script lang="ts">
  import { onMount } from "svelte";
  import { serverFunctions } from "@${projectName}/shared/utils/server";

  let loading = $state(true);
  let error = $state<string | null>(null);
  let user = $state<{ email: string } | null>(null);${containerState}

  onMount(async () => {
    try {
      ${mountBody}
    } catch (err) {
      error = err instanceof Error ? err.message : "Something went wrong.";
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
<div ${hasTailwind ? 'class="flex min-h-screen items-center justify-center text-sm text-muted-foreground"' : 'style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #94a3b8; font-size: 13px"'}>Loading workspace…</div>
{:else if error}
${errorEl}
{:else}
${wrapper}
  ${titleEl}
  ${infoBlock}${aboutBtn}
</div>
{/if}
`;
};

// ─── SOLID ────────────────────────────────────────────────────────────────────

const solidMainTsx = (projectName: string) =>
  `import { render } from "solid-js/web";
import { App } from "./App";
import "@${projectName}/shared/styles/global.css";

render(() => <App />, document.getElementById("root")!);
`;

const solidAppTsx = (projectName: string, hasTailwind: boolean, addonType: GasAddonType) => {
  const cs = CONTAINER[addonType] ?? null;
  const isAddon = addonType !== "standalone";

  const containerSignal = cs
    ? `\n  const [${cs.stateVar}, set${cap(cs.stateVar)}] = createSignal<${cs.type} | null>(null);`
    : "";

  const mountBody = cs
    ? `const [u, c] = await Promise.all([
      serverFunctions.getCurrentUser(),
      serverFunctions.${cs.fn}(),
    ]);
    setUser(u);
    set${cap(cs.stateVar)}(c);`
    : `const u = await serverFunctions.getCurrentUser();
    setUser(u);`;

  const loadingEl = hasTailwind
    ? `<div class="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading workspace…</div>`
    : `<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#94a3b8", fontSize: "13px" }}>Loading workspace…</div>`;

  const wrapper = hasTailwind
    ? `<div class="flex min-h-screen flex-col gap-4 p-5">`
    : `<div style={{ minHeight: "100vh", background: "#f8fafc", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>`;
  const titleEl = hasTailwind
    ? `<div>
          <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-500">● Google Apps Script</p>
          <h1 class="text-[21px] font-extrabold tracking-tight text-foreground">My GAS App</h1>
          <p class="mt-1.5 text-xs text-muted-foreground">Type-safe server calls · Live reload · Zero lock-in</p>
        </div>`
    : `<div>
          <p style={{ margin: "0 0 8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6366f1" }}>● Google Apps Script</p>
          <h1 style={{ margin: 0, fontSize: "21px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.025em", lineHeight: 1.2 }}>My GAS App</h1>
          <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>Type-safe server calls · Live reload · Zero lock-in</p>
        </div>`;

  // For Solid, signal accessors need () — e.g. spreadsheet()?.name
  const allRows: [string, string][] = [
    ["User", "user()?.email"],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `${cs.stateVar}()?.${field}`]) : []),
  ];
  const infoBlock = hasTailwind
    ? `<div class="overflow-hidden rounded-2xl border border-border/60 bg-background">
${allRows.map(([l, e], i) => {
  const border = i < allRows.length - 1 ? "border-b border-border/50 " : "";
  return `          <div class="${border}flex items-center justify-between gap-3 px-4 py-3"><span class="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">${l}</span><span class="truncate text-[13px] font-medium text-foreground">{${e}}</span></div>`;
}).join("\n")}
        </div>`
    : `<div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
${allRows.map(([l, e], i) => {
  const sep = i < allRows.length - 1 ? `"1px solid #f1f5f9"` : `"none"`;
  return `          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: ${sep}, gap: "12px" }}><span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", flexShrink: 0 }}>${l}</span><span style={{ fontSize: "13px", fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58%" }}>{${e}}</span></div>`;
}).join("\n")}
        </div>`;

  const aboutBtn = isAddon
    ? hasTailwind
      ? `\n        <div class="mt-auto flex justify-end"><button onClick={() => serverFunctions.openAboutDialog()} class="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">About</button></div>`
      : `\n        <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}><button onClick={() => serverFunctions.openAboutDialog()} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#334155", padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>About</button></div>`
    : "";

  const errorEl = hasTailwind
    ? `<div class="flex min-h-screen items-center justify-center p-4 text-center text-sm text-destructive">{error()}</div>`
    : `<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#ef4444", fontSize: "13px", padding: "16px", textAlign: "center" }}>{error()}</div>`;

  return `import { createSignal, onMount } from "solid-js";
import { serverFunctions } from "@${projectName}/shared/utils/server";

export function App() {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [user, setUser] = createSignal<{ email: string } | null>(null);${containerSignal}

  onMount(async () => {
    try {
      ${mountBody}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  });

  return loading()
    ? ${loadingEl}
    : error()
      ? ${errorEl}
      : (
        ${wrapper}
          ${titleEl}
          ${infoBlock}${aboutBtn}
        </div>
      );
}
`;
};

// ─── About dialog Apps ────────────────────────────────────────────────────────

const reactAboutAppTsx = (projectName: string, hasTailwind: boolean, hasShadcn: boolean) => {
  const uiMode = hasShadcn ? "shadcn" : hasTailwind ? "tailwind" : "inline";
  const imports = hasShadcn
    ? `import { Button } from "@${projectName}/ui/components/button";\nimport { scriptHostFunctions } from "@${projectName}/shared/utils/server";`
    : `import { scriptHostFunctions } from "@${projectName}/shared/utils/server";`;
  const closeBtnInline = `<button onClick={() => scriptHostFunctions.close()} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#334155", padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Close</button>`;
  const closeBtnTailwind = `<button onClick={() => scriptHostFunctions.close()} className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">Close</button>`;
  const closeBtnShadcn = `<Button variant="outline" onClick={() => scriptHostFunctions.close()}>Close</Button>`;
  const closeBtn = uiMode === "inline" ? closeBtnInline : uiMode === "tailwind" ? closeBtnTailwind : closeBtnShadcn;
  const bodyInline = `<div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", marginBottom: "16px" }} />
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.025em" }}>My GAS App</h1>
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>A modern scaffold for Google Apps Script add-ons — type-safe, live reload, zero lock-in.</p>
      </div>
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "12px 16px" }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Stack</p>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#334155" }}>Vite · TypeScript · gas-client · Monorepo</p>
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
        ${closeBtn}
      </div>
    </div>`;
  const bodyTailwind = `<div className="flex min-h-screen flex-col gap-5 p-6">
      <div>
        <div className="mb-4 size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500" />
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">My GAS App</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A modern scaffold for Google Apps Script add-ons — type-safe, live reload, zero lock-in.</p>
      </div>
      <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Stack</p>
        <p className="mt-1 text-sm text-foreground">Vite · TypeScript · gas-client · Monorepo</p>
      </div>
      <div className="mt-auto flex justify-end">
        ${closeBtn}
      </div>
    </div>`;
  const body = uiMode === "inline" ? bodyInline : bodyTailwind;

  return `${imports}

export function App() {
  return (
    ${body}
  );
}
`;
};

const vueAboutAppVue = (projectName: string, hasTailwind: boolean) => {
  const btn = hasTailwind
    ? `<button @click="close" class="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">Close</button>`
    : `<button @click="close" style="border: 1px solid #e2e8f0; background: #fff; color: #334155; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600">Close</button>`;

  return `<script setup lang="ts">
import { scriptHostFunctions } from "@${projectName}/shared/utils/server";
const close = () => scriptHostFunctions.close();
</script>

<template>
  <div ${hasTailwind ? 'class="flex min-h-screen flex-col gap-5 p-6"' : 'style="min-height: 100vh; background: #f8fafc; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px"'}>
    <div>
      ${hasTailwind ? '<div class="mb-4 size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500" />' : '<div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); margin-bottom: 16px" />'}
      <h1 ${hasTailwind ? 'class="text-xl font-extrabold tracking-tight text-foreground"' : 'style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em"'}>My GAS App</h1>
      <p ${hasTailwind ? 'class="mt-2 text-sm leading-relaxed text-muted-foreground"' : 'style="margin: 6px 0 0; font-size: 13px; color: #64748b; line-height: 1.5"'}>A modern scaffold for Google Apps Script add-ons — type-safe, live reload, zero lock-in.</p>
    </div>
    <div ${hasTailwind ? 'class="rounded-xl border border-border/70 bg-background px-4 py-3"' : 'style="background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 12px 16px"'}>
      <p ${hasTailwind ? 'class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"' : 'style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8"'}>Stack</p>
      <p ${hasTailwind ? 'class="mt-1 text-sm text-foreground"' : 'style="margin: 4px 0 0; font-size: 13px; color: #334155"'}>Vite · TypeScript · gas-client · Monorepo</p>
    </div>
    <div ${hasTailwind ? 'class="mt-auto flex justify-end"' : 'style="margin-top: auto; display: flex; justify-content: flex-end"'}>
      ${btn}
    </div>
  </div>
</template>
`;
};

const svelteAboutAppSvelte = (projectName: string, hasTailwind: boolean) => {
  const btn = hasTailwind
    ? `<button onclick={close} class="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">Close</button>`
    : `<button onclick={close} style="border: 1px solid #e2e8f0; background: #fff; color: #334155; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600">Close</button>`;

  return `<script lang="ts">
  import { scriptHostFunctions } from "@${projectName}/shared/utils/server";
  const close = () => scriptHostFunctions.close();
</script>

<div ${hasTailwind ? 'class="flex min-h-screen flex-col gap-5 p-6"' : 'style="min-height: 100vh; background: #f8fafc; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px"'}>
  <div>
    ${hasTailwind ? '<div class="mb-4 size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500"></div>' : '<div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); margin-bottom: 16px"></div>'}
    <h1 ${hasTailwind ? 'class="text-xl font-extrabold tracking-tight text-foreground"' : 'style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em"'}>My GAS App</h1>
    <p ${hasTailwind ? 'class="mt-2 text-sm leading-relaxed text-muted-foreground"' : 'style="margin: 6px 0 0; font-size: 13px; color: #64748b; line-height: 1.5"'}>A modern scaffold for Google Apps Script add-ons — type-safe, live reload, zero lock-in.</p>
  </div>
  <div ${hasTailwind ? 'class="rounded-xl border border-border/70 bg-background px-4 py-3"' : 'style="background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 12px 16px"'}>
    <p ${hasTailwind ? 'class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"' : 'style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8"'}>Stack</p>
    <p ${hasTailwind ? 'class="mt-1 text-sm text-foreground"' : 'style="margin: 4px 0 0; font-size: 13px; color: #334155"'}>Vite · TypeScript · gas-client · Monorepo</p>
  </div>
  <div ${hasTailwind ? 'class="mt-auto flex justify-end"' : 'style="margin-top: auto; display: flex; justify-content: flex-end"'}>
    ${btn}
  </div>
</div>
`;
};

const solidAboutAppTsx = (projectName: string, hasTailwind: boolean) => {
  const btn = hasTailwind
    ? `<button onClick={close} class="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">Close</button>`
    : `<button onClick={close} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#334155", padding: "8px 16px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Close</button>`;

  return `import { scriptHostFunctions } from "@${projectName}/shared/utils/server";

const close = () => scriptHostFunctions.close();

export function App() {
  return (
    <div ${hasTailwind ? 'class="flex min-h-screen flex-col gap-5 p-6"' : 'style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}'}>
      <div>
        ${hasTailwind ? '<div class="mb-4 size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500" />' : '<div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", marginBottom: "16px" }} />'}
        <h1 ${hasTailwind ? 'class="text-xl font-extrabold tracking-tight text-foreground"' : 'style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.025em" }}'}>My GAS App</h1>
        <p ${hasTailwind ? 'class="mt-2 text-sm leading-relaxed text-muted-foreground"' : 'style={{ margin: "6px 0 0", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}'}>A modern scaffold for Google Apps Script add-ons — type-safe, live reload, zero lock-in.</p>
      </div>
      <div ${hasTailwind ? 'class="rounded-xl border border-border/70 bg-background px-4 py-3"' : 'style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "12px 16px" }}'}>
        <p ${hasTailwind ? 'class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"' : 'style={{ margin: 0, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}'}>Stack</p>
        <p ${hasTailwind ? 'class="mt-1 text-sm text-foreground"' : 'style={{ margin: "4px 0 0", fontSize: "13px", color: "#334155" }}'}>Vite · TypeScript · gas-client · Monorepo</p>
      </div>
      <div ${hasTailwind ? 'class="mt-auto flex justify-end"' : 'style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}'}>
        ${btn}
      </div>
    </div>
  );
}
`;
};

// ─── VANILLA ──────────────────────────────────────────────────────────────────

const vanillaMainTs = (projectName: string) =>
  `import "@${projectName}/shared/styles/global.css";
import { App } from "./App";

new App(document.getElementById("root")!);
`;

const vanillaAppTs = (
  projectName: string,
  hasTailwind: boolean,
  addonType: GasAddonType,
) => {
  const cs = CONTAINER[addonType] ?? null;
  const isAddon = addonType !== "standalone";

  const containerDecl = cs ? `\n  private ${cs.stateVar}: ${cs.type} | null = null;` : "";

  const fetchBody = cs
    ? `const [user, info] = await Promise.all([
        serverFunctions.getCurrentUser(),
        serverFunctions.${cs.fn}(),
      ]);
      this.user = user;
      this.${cs.stateVar} = info;`
    : `this.user = await serverFunctions.getCurrentUser();`;

  const allRows: [string, string][] = [
    ["User", `this.user?.email`],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `this.${cs.stateVar}?.${field}`]) : []),
  ];

  const rowsHtml = allRows
    .map(([label, expr], i) => {
      const sep = i < allRows.length - 1 ? " border-bottom: 1px solid #f1f5f9;" : "";
      return `    row("${label}", String(${expr} ?? ""))`;
    })
    .join(",\n");

  const aboutBtn = isAddon
    ? hasTailwind
      ? `
    const btn = el("button", "rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted");
    btn.textContent = "About";
    btn.onclick = () => serverFunctions.openAboutDialog();
    const footer = el("div", "mt-auto flex justify-end");
    footer.appendChild(btn);
    container.appendChild(footer);`
      : `
    const btn = document.createElement("button");
    btn.textContent = "About";
    btn.style.cssText = "border: 1px solid #e2e8f0; background: #fff; color: #334155; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600";
    btn.onclick = () => serverFunctions.openAboutDialog();
    const footer = document.createElement("div");
    footer.style.cssText = "margin-top: auto; display: flex; justify-content: flex-end";
    footer.appendChild(btn);
    container.appendChild(footer);`
    : "";

  if (hasTailwind) {
    return `import { serverFunctions } from "@${projectName}/shared/utils/server";

const el = (tag: string, cls = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

const row = (label: string, value: string) => {
  const r = el("div", "flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-b-0");
  const l = el("span", "shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground");
  const v = el("span", "truncate text-[13px] font-medium text-foreground");
  l.textContent = label;
  v.textContent = value;
  r.append(l, v);
  return r;
};

export class App {
  private user: { email: string } | null = null;${containerDecl}

  constructor(private root: HTMLElement) {
    this.init();
  }

  private async init() {
    this.root.innerHTML = \`<div class="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading workspace…</div>\`;
    try {
      ${fetchBody}
      this.render();
    } catch (err) {
      this.root.innerHTML = \`<div class="flex min-h-screen items-center justify-center p-4 text-center text-sm text-destructive">\${err instanceof Error ? err.message : "Something went wrong."}</div>\`;
    }
  }

  private render() {
    this.root.innerHTML = "";
    const container = el("div", "flex min-h-screen flex-col gap-4 p-5");

    const header = el("div");
    const tag = el("p", "mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-500");
    tag.textContent = "● Google Apps Script";
    const title = el("h1", "text-[21px] font-extrabold tracking-tight text-foreground");
    title.textContent = "My GAS App";
    const sub = el("p", "mt-1.5 text-xs text-muted-foreground");
    sub.textContent = "Type-safe server calls · Live reload · Zero lock-in";
    header.append(tag, title, sub);

    const card = el("div", "overflow-hidden rounded-2xl border border-border/60 bg-background");
    card.append(
${rowsHtml},
    );

    container.append(header, card);${aboutBtn}
    this.root.appendChild(container);
  }
}
`;
  }

  return `import { serverFunctions } from "@${projectName}/shared/utils/server";

const row = (label: string, value: string, last = false): HTMLElement => {
  const r = document.createElement("div");
  r.style.cssText = \`display: flex; align-items: center; justify-content: space-between; padding: 11px 16px; gap: 12px;\${last ? "" : " border-bottom: 1px solid #f1f5f9;"}\`;
  const l = document.createElement("span");
  l.style.cssText = "font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; flex-shrink: 0";
  const v = document.createElement("span");
  v.style.cssText = "font-size: 13px; font-weight: 500; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 58%";
  l.textContent = label;
  v.textContent = value;
  r.append(l, v);
  return r;
};

export class App {
  private user: { email: string } | null = null;${containerDecl}

  constructor(private root: HTMLElement) {
    this.init();
  }

  private async init() {
    this.root.innerHTML = \`<div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #94a3b8; font-size: 13px">Loading workspace…</div>\`;
    try {
      ${fetchBody}
      this.render();
    } catch (err) {
      this.root.innerHTML = \`<div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #ef4444; font-size: 13px; padding: 16px; text-align: center">\${err instanceof Error ? err.message : "Something went wrong."}</div>\`;
    }
  }

  private render() {
    this.root.innerHTML = "";
    const container = document.createElement("div");
    container.style.cssText = "min-height: 100vh; background: #f8fafc; padding: 20px 16px; display: flex; flex-direction: column; gap: 14px";

    const header = document.createElement("div");
    const tag = document.createElement("p");
    tag.style.cssText = "margin: 0 0 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6366f1";
    tag.textContent = "● Google Apps Script";
    const title = document.createElement("h1");
    title.style.cssText = "margin: 0; font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; line-height: 1.2";
    title.textContent = "My GAS App";
    const sub = document.createElement("p");
    sub.style.cssText = "margin: 5px 0 0; font-size: 12px; color: #64748b; line-height: 1.5";
    sub.textContent = "Type-safe server calls · Live reload · Zero lock-in";
    header.append(tag, title, sub);

    const card = document.createElement("div");
    card.style.cssText = "background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); overflow: hidden";
    const allRows = [${allRows.map(([l, e]) => `["${l}", String(${e} ?? "")]`).join(", ")}];
    allRows.forEach(([l, v], i) => card.appendChild(row(l, v, i === allRows.length - 1)));

    container.append(header, card);${aboutBtn}
    this.root.appendChild(container);
  }
}
`;
};

const vanillaAboutAppTs = (projectName: string, hasTailwind: boolean) => {
  if (hasTailwind) {
    return `import { scriptHostFunctions } from "@${projectName}/shared/utils/server";

const el = (tag: string, cls = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

const root = document.getElementById("root")!;
const container = el("div", "flex min-h-screen flex-col gap-5 p-6");

const icon = el("div", "mb-4 size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500");
const title = el("h1", "text-xl font-extrabold tracking-tight text-foreground");
title.textContent = "My GAS App";
const desc = el("p", "mt-2 text-sm leading-relaxed text-muted-foreground");
desc.textContent = "A modern scaffold for Google Apps Script add-ons — type-safe, live reload, zero lock-in.";
const header = el("div");
header.append(icon, title, desc);

const card = el("div", "rounded-xl border border-border/70 bg-background px-4 py-3");
const stackLabel = el("p", "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground");
stackLabel.textContent = "Stack";
const stackVal = el("p", "mt-1 text-sm text-foreground");
stackVal.textContent = "Vite · TypeScript · gas-client · Monorepo";
card.append(stackLabel, stackVal);

const closeBtn = el("button", "rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted");
closeBtn.textContent = "Close";
closeBtn.onclick = () => scriptHostFunctions.close();
const footer = el("div", "mt-auto flex justify-end");
footer.appendChild(closeBtn);

container.append(header, card, footer);
root.appendChild(container);
`;
  }

  return `import { scriptHostFunctions } from "@${projectName}/shared/utils/server";

const root = document.getElementById("root")!;
const container = document.createElement("div");
container.style.cssText = "min-height: 100vh; background: #f8fafc; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px";

const icon = document.createElement("div");
icon.style.cssText = "width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); margin-bottom: 16px";
const title = document.createElement("h1");
title.style.cssText = "margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em";
title.textContent = "My GAS App";
const desc = document.createElement("p");
desc.style.cssText = "margin: 6px 0 0; font-size: 13px; color: #64748b; line-height: 1.5";
desc.textContent = "A modern scaffold for Google Apps Script add-ons — type-safe, live reload, zero lock-in.";
const header = document.createElement("div");
header.append(icon, title, desc);

const card = document.createElement("div");
card.style.cssText = "background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 12px 16px";
const stackLabel = document.createElement("p");
stackLabel.style.cssText = "margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8";
stackLabel.textContent = "Stack";
const stackVal = document.createElement("p");
stackVal.style.cssText = "margin: 4px 0 0; font-size: 13px; color: #334155";
stackVal.textContent = "Vite · TypeScript · gas-client · Monorepo";
card.append(stackLabel, stackVal);

const closeBtn = document.createElement("button");
closeBtn.textContent = "Close";
closeBtn.style.cssText = "border: 1px solid #e2e8f0; background: #fff; color: #334155; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600";
closeBtn.onclick = () => scriptHostFunctions.close();
const footer = document.createElement("div");
footer.style.cssText = "margin-top: auto; display: flex; justify-content: flex-end";
footer.appendChild(closeBtn);

container.append(header, card, footer);
root.appendChild(container);
`;
};

// ─── Framework dispatch ───────────────────────────────────────────────────────

function getEntryExt(fw: Framework): { mainExt: string; appExt: string } {
  return {
    react: { mainExt: "tsx", appExt: "tsx" },
    vue: { mainExt: "ts", appExt: "vue" },
    svelte: { mainExt: "ts", appExt: "svelte" },
    solid: { mainExt: "tsx", appExt: "tsx" },
    vanilla: { mainExt: "ts", appExt: "ts" },
  }[fw];
}

function getFrameworkFiles(
  config: ProjectConfig,
  projectName: string,
): { mainContent: string; appContent: string; aboutAppContent: string } {
  const tw = hasTailwind(config.addons);
  const hasShadcn = config.addons.includes("shadcn");
  switch (config.framework) {
    case "react":
      return {
        mainContent: reactMainTsx(projectName),
        appContent: reactAppTsx(projectName, tw, hasShadcn, config.addonType),
        aboutAppContent: reactAboutAppTsx(projectName, tw, hasShadcn),
      };
    case "vue":
      return {
        mainContent: vueMainTs(projectName),
        appContent: vueAppVue(projectName, tw, config.addonType),
        aboutAppContent: vueAboutAppVue(projectName, tw),
      };
    case "svelte":
      return {
        mainContent: svelteMainTs(projectName),
        appContent: svelteAppSvelte(projectName, tw, config.addonType),
        aboutAppContent: svelteAboutAppSvelte(projectName, tw),
      };
    case "solid":
      return {
        mainContent: solidMainTsx(projectName),
        appContent: solidAppTsx(projectName, tw, config.addonType),
        aboutAppContent: solidAboutAppTsx(projectName, tw),
      };
    case "vanilla":
      return {
        mainContent: vanillaMainTs(projectName),
        appContent: vanillaAppTs(projectName, tw, config.addonType),
        aboutAppContent: vanillaAboutAppTs(projectName, tw),
      };
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateClient(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const pp = (...s: string[]) => projectPath(root, ...s);
  const tw = hasTailwind(config.addons);

  // packages/shared — styles
  await writeFile(
    pp("packages", "shared", "src", "styles", "global.css"),
    tw ? globalCssTailwind : globalCssBase,
  );
  await writeFile(pp("apps", config.projectName, "env.ts"), appEnvTs());

  // apps/<projectName>/dialogs/sidebar
  const isAddon = config.addonType !== "standalone";
  const dialogDir = pp("apps", config.projectName, "dialogs", "sidebar");
  const { mainExt, appExt } = getEntryExt(config.framework);
  const { mainContent, appContent, aboutAppContent } = getFrameworkFiles(config, config.projectName);

  await writeFile(
    `${dialogDir}/index.html`,
    indexHtml("Sidebar", `./src/main.${mainExt}`, config.framework),
  );
  await writeFile(`${dialogDir}/src/main.${mainExt}`, mainContent);
  await writeFile(`${dialogDir}/src/App.${appExt}`, appContent);

  // apps/<projectName>/dialogs/about (addon types only — standalone has no modal dialogs)
  if (isAddon) {
    const aboutDir = pp("apps", config.projectName, "dialogs", "about");
    await writeFile(
      `${aboutDir}/index.html`,
      indexHtml("About", `./src/main.${mainExt}`, config.framework),
    );
    await writeFile(`${aboutDir}/src/main.${mainExt}`, mainContent);
    await writeFile(`${aboutDir}/src/App.${appExt}`, aboutAppContent);
  }
}
