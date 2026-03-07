import type { Framework, GasAddonType, ProjectConfig } from "../types.js";
import { writeFile, projectPath } from "../utils/fs.js";
import { IMPORT_MAPS } from "../constants/scaffold.js";

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
    type: "{ id: string; name: string; activeSheet: string }",
    fields: [["Spreadsheet", "name"], ["Sheet", "activeSheet"]],
  },
  docs: {
    fn: "getDocumentInfo",
    stateVar: "document",
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
  font-family: -apple-system, BlinkMacSystemFont, "Inter", Arial, Roboto,
    "Helvetica Neue", sans-serif;
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
      ? `<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#475569", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial" }}>Loading workspace…</div>`
      : `<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading workspace…</div>`;

  const infoRowsInline = allRows
    .map(
      ([l, e]) =>
        `            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px dashed #d1d5db" }}><span style={{ color: "#64748b", fontWeight: 600, letterSpacing: 0.3 }}>{${JSON.stringify(l)}}</span><span style={{ color: "#0f172a" }}>{${e}}</span></div>`,
    )
    .join("\n");
  const infoRowsTailwind = allRows
    .map(
      ([l, e]) =>
        `            <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/70 py-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">${l}</span><span className="font-medium text-foreground">{${e}}</span></div>`,
    )
    .join("\n");

  const actionInline = isAddon
    ? `\n          <button onClick={() => serverFunctions.openAboutDialog()} style={{ border: "1px solid #cbd5e1", background: "white", color: "#0f172a", padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Open About</button>`
    : "";
  const actionTailwind = isAddon
    ? `\n          <button onClick={() => serverFunctions.openAboutDialog()} className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent">Open About</button>`
    : "";
  const actionShadcn = isAddon
    ? `\n          <Button variant="outline" onClick={() => serverFunctions.openAboutDialog()}>Open About</Button>`
    : "";

  const bodyInline = `<div style={{ minHeight: "100vh", background: "linear-gradient(165deg, #f8fafc 0%, #eef2ff 45%, #ecfeff 100%)", padding: 20, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <section style={{ borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.9)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#6366f1", fontWeight: 700 }}>Google Apps Script</p>
          <h1 style={{ margin: "8px 0 6px", fontSize: 28, lineHeight: 1.1, color: "#0f172a" }}>My GAS App</h1>
          <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>A modern, typed sidebar shell ready for your workflow logic.</p>
        </section>
        <section style={{ borderRadius: 18, padding: "8px 16px", background: "rgba(255,255,255,0.92)", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
${infoRowsInline}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Ready to wire server actions.</span>${actionInline}
          </div>
        </section>
      </div>
    </div>`;

  const bodyTailwind = `<div className="min-h-screen bg-[radial-gradient(1200px_400px_at_-10%_-20%,#e0e7ff_20%,transparent_60%),radial-gradient(900px_300px_at_120%_0%,#ccfbf1_15%,transparent_50%)] p-5">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <section className="rounded-2xl border border-border/70 bg-background/90 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Google Apps Script</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">My GAS App</h1>
          <p className="mt-2 text-sm text-muted-foreground">A modern, typed sidebar shell ready for your workflow logic.</p>
        </section>
        <section className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm">
${infoRowsTailwind}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ready to wire server actions.</span>${uiMode === "tailwind" ? actionTailwind : actionShadcn}
          </div>
        </section>
      </div>
    </div>`;

  const body = uiMode === "inline" ? bodyInline : bodyTailwind;

  return `import { serverFunctions } from "@${projectName}/shared/utils/server";
import { useEffect, useState } from "react";
${importLine}

export function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string } | null>(null);${containerState}

  useEffect(() => {
    ${effectBody}
  }, []);

  if (loading) return ${loadingEl};

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
    ? `<div v-if="loading" class="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>`
    : `<div v-if="loading" style="padding: 24px">Loading…</div>`;
  const wrapper = hasTailwind
    ? `<div v-else class="flex min-h-screen flex-col gap-4 p-6">`
    : `<div v-else style="padding: 24px; max-width: 400px; margin: 0 auto">`;
  const titleEl = hasTailwind
    ? `<h1 class="text-2xl font-bold">My GAS App</h1>`
    : `<h1 style="font-size: 1.5rem; font-weight: bold">My GAS App</h1>`;

  // Info rows
  const allRows: [string, string][] = [
    ["User", "user?.email"],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `${cs.stateVar}?.${field}`]) : []),
  ];
  const infoBlock = hasTailwind
    ? `<div class="rounded-md border border-border p-4 text-sm space-y-2">
      ${allRows.map(([l, e]) => `<div class="flex gap-2"><span class="w-28 text-muted-foreground">${l}</span><span>{{ ${e} }}</span></div>`).join("\n      ")}
    </div>`
    : `<div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 0.875rem; display: flex; flex-direction: column; gap: 8px">
      ${allRows.map(([l, e]) => `<p style="margin: 0"><span style="font-weight: 600; color: #6b7280">${l}: </span>{{ ${e} }}</p>`).join("\n      ")}
    </div>`;

  const aboutBtn = isAddon
    ? hasTailwind
      ? `\n    <button @click="() => serverFunctions.openAboutDialog()" class="self-start rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">About</button>`
      : `\n    <button @click="() => serverFunctions.openAboutDialog()" style="margin-top: 8px">About</button>`
    : "";

  return `<script setup lang="ts">
import { onMounted, ref } from "vue";
import { serverFunctions } from "@${projectName}/shared/utils/server";

const loading = ref(true);
const user = ref<{ email: string } | null>(null);${containerRef}

onMounted(async () => {
  ${mountedBody}
});
</script>

<template>
  ${loadingTmpl}
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
    ? `<div class="flex min-h-screen flex-col gap-4 p-6">`
    : `<div style="padding:24px;max-width:400px;margin:0 auto">`;
  const titleEl = hasTailwind
    ? `<h1 class="text-2xl font-bold">My GAS App</h1>`
    : `<h1 style="font-size:1.5rem;font-weight:bold">My GAS App</h1>`;

  const allRows: [string, string][] = [
    ["User", "user?.email"],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `${cs.stateVar}?.${field}`]) : []),
  ];
  const infoBlock = hasTailwind
    ? `<div class="rounded-md border border-border p-4 text-sm space-y-2">
  ${allRows.map(([l, e]) => `<div class="flex gap-2"><span class="w-28 text-muted-foreground">${l}</span><span>{${e}}</span></div>`).join("\n  ")}
</div>`
    : `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:0.875rem;display:flex;flex-direction:column;gap:8px">
  ${allRows.map(([l, e]) => `<p style="margin:0"><span style="font-weight:600;color:#6b7280">${l}: </span>{${e}}</p>`).join("\n  ")}
</div>`;

  const aboutBtn = isAddon
    ? hasTailwind
      ? `\n<button onclick={() => serverFunctions.openAboutDialog()} class="self-start rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">About</button>`
      : `\n<button onclick={() => serverFunctions.openAboutDialog()} style="margin-top:8px">About</button>`
    : "";

  return `<script lang="ts">
  import { onMount } from "svelte";
  import { serverFunctions } from "@${projectName}/shared/utils/server";

  let loading = $state(true);
  let user = $state<{ email: string } | null>(null);${containerState}

  onMount(async () => {
    ${mountBody}
    loading = false;
  });
</script>

{#if loading}
<div ${hasTailwind ? 'class="flex min-h-screen items-center justify-center text-sm text-muted-foreground"' : 'style="padding:24px"'}>Loading…</div>
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
    ? `<div class="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading…</div>`
    : `<div style={{ padding: "24px" }}>Loading…</div>`;

  const wrapper = hasTailwind
    ? `<div class="flex min-h-screen flex-col gap-4 p-6">`
    : `<div style={{ padding: "24px", "max-width": "400px", margin: "0 auto" }}>`;
  const titleEl = hasTailwind
    ? `<h1 class="text-2xl font-bold">My GAS App</h1>`
    : `<h1 style={{ "font-size": "1.5rem", "font-weight": "bold" }}>My GAS App</h1>`;

  // For Solid, signal accessors need () — e.g. spreadsheet()?.name
  const allRows: [string, string][] = [
    ["User", "user()?.email"],
    ...(cs ? cs.fields.map(([label, field]): [string, string] => [label, `${cs.stateVar}()?.${field}`]) : []),
  ];
  const infoBlock = hasTailwind
    ? `<div class="rounded-md border border-gray-200 p-4 text-sm space-y-2">
${allRows.map(([l, e]) => `          <div class="flex gap-2"><span class="w-28 text-gray-500">${l}</span><span>{${e}}</span></div>`).join("\n")}
        </div>`
    : `<div style={{ border: "1px solid #e5e7eb", "border-radius": "6px", padding: "12px", "font-size": "0.875rem", display: "flex", "flex-direction": "column", gap: "8px" }}>
${allRows.map(([l, e]) => `          <p style={{ margin: 0 }}><span style={{ "font-weight": 600, color: "#6b7280" }}>${l}: </span>{${e}}</p>`).join("\n")}
        </div>`;

  const aboutBtn = isAddon
    ? hasTailwind
      ? `\n        <button onClick={() => serverFunctions.openAboutDialog()} class="self-start rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">About</button>`
      : `\n        <button onClick={() => serverFunctions.openAboutDialog()} style={{ "margin-top": "8px" }}>About</button>`
    : "";

  return `import { createSignal, onMount } from "solid-js";
import { serverFunctions } from "@${projectName}/shared/utils/server";

export function App() {
  const [loading, setLoading] = createSignal(true);
  const [user, setUser] = createSignal<{ email: string } | null>(null);${containerSignal}

  onMount(async () => {
    ${mountBody}
    setLoading(false);
  });

  return loading()
    ? ${loadingEl}
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
  const closeBtnInline = `<button onClick={() => scriptHostFunctions.close()} style={{ border: "1px solid #cbd5e1", background: "white", color: "#0f172a", padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Close</button>`;
  const closeBtnTailwind = `<button onClick={() => scriptHostFunctions.close()} className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent">Close</button>`;
  const closeBtnShadcn = `<Button variant="outline" onClick={() => scriptHostFunctions.close()}>Close</Button>`;
  const closeBtn = uiMode === "inline" ? closeBtnInline : uiMode === "tailwind" ? closeBtnTailwind : closeBtnShadcn;
  const bodyInline = `<div style={{ minHeight: "100vh", background: "linear-gradient(165deg, #f8fafc 0%, #eef2ff 45%, #ecfeff 100%)", padding: 20, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <section style={{ borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.9)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#06b6d4", fontWeight: 700 }}>Dialog</p>
          <h1 style={{ margin: "8px 0 6px", fontSize: 28, lineHeight: 1.1, color: "#0f172a" }}>About This Add-on</h1>
          <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>Built with create-gas-app using a modular monorepo template.</p>
        </section>
        <section style={{ borderRadius: 18, padding: "14px 16px", background: "rgba(255,255,255,0.92)", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
          <p style={{ margin: "0 0 12px", color: "#334155", fontSize: 14 }}>Use this dialog to share product metadata, support links, or release notes.</p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            ${closeBtn}
          </div>
        </section>
      </div>
    </div>`;
  const bodyTailwind = `<div className="min-h-screen bg-[radial-gradient(1200px_400px_at_-10%_-20%,#cffafe_20%,transparent_60%),radial-gradient(900px_300px_at_120%_0%,#e0e7ff_15%,transparent_50%)] p-5">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <section className="rounded-2xl border border-border/70 bg-background/90 p-5 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">Dialog</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">About This Add-on</h1>
          <p className="mt-2 text-sm text-muted-foreground">Built with create-gas-app using a modular monorepo template.</p>
        </section>
        <section className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Use this dialog to share product metadata, support links, or release notes.</p>
          <div className="mt-4 flex justify-end">
            ${closeBtn}
          </div>
        </section>
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
    ? `<button @click="close" class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Close</button>`
    : `<button @click="close" style="padding: 8px 16px; cursor: pointer">Close</button>`;

  return `<script setup lang="ts">
import { scriptHostFunctions } from "@${projectName}/shared/utils/server";
const close = () => scriptHostFunctions.close();
</script>

<template>
  <div ${hasTailwind ? 'class="flex flex-col gap-4 p-6"' : 'style="padding: 24px; display: flex; flex-direction: column; gap: 16px"'}>
    <h1 ${hasTailwind ? 'class="text-xl font-bold"' : 'style="font-size: 1.25rem; font-weight: bold; margin: 0"'}>About</h1>
    <p ${hasTailwind ? 'class="text-sm text-gray-500"' : 'style="color: #666; font-size: 0.875rem; margin: 0"'}>Built with create-gas-app.</p>
    <div ${hasTailwind ? 'class="flex justify-end"' : 'style="display:flex;justify-content:flex-end"'}>
      ${btn}
    </div>
  </div>
</template>
`;
};

const svelteAboutAppSvelte = (projectName: string, hasTailwind: boolean) => {
  const btn = hasTailwind
    ? `<button onclick={close} class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Close</button>`
    : `<button onclick={close} style="padding:8px 16px;cursor:pointer">Close</button>`;

  return `<script lang="ts">
  import { scriptHostFunctions } from "@${projectName}/shared/utils/server";
  const close = () => scriptHostFunctions.close();
</script>

<div ${hasTailwind ? 'class="flex flex-col gap-4 p-6"' : 'style="padding:24px;display:flex;flex-direction:column;gap:16px"'}>
  <h1 ${hasTailwind ? 'class="text-xl font-bold"' : 'style="font-size:1.25rem;font-weight:bold;margin:0"'}>About</h1>
  <p ${hasTailwind ? 'class="text-sm text-gray-500"' : 'style="color:#666;font-size:0.875rem;margin:0"'}>Built with create-gas-app.</p>
  <div ${hasTailwind ? 'class="flex justify-end"' : 'style="display:flex;justify-content:flex-end"'}>
    ${btn}
  </div>
</div>
`;
};

const solidAboutAppTsx = (projectName: string, hasTailwind: boolean) => {
  const btn = hasTailwind
    ? `<button onClick={close} class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Close</button>`
    : `<button onClick={close} style={{ padding: "8px 16px", cursor: "pointer" }}>Close</button>`;

  return `import { scriptHostFunctions } from "@${projectName}/shared/utils/server";

const close = () => scriptHostFunctions.close();

export function App() {
  return (
    <div ${hasTailwind ? 'class="flex flex-col gap-4 p-6"' : 'style={{ padding: "24px", display: "flex", "flex-direction": "column", gap: "16px" }}'}>
      <h1 ${hasTailwind ? 'class="text-xl font-bold"' : 'style={{ "font-size": "1.25rem", "font-weight": "bold", margin: 0 }}'}>About</h1>
      <p ${hasTailwind ? 'class="text-sm text-gray-500"' : 'style={{ color: "#666", "font-size": "0.875rem", margin: 0 }}'}>Built with create-gas-app.</p>
      <div ${hasTailwind ? 'class="flex justify-end"' : 'style={{ display: "flex", "justify-content": "flex-end" }}'}>
        ${btn}
      </div>
    </div>
  );
}
`;
};

// ─── Framework dispatch ───────────────────────────────────────────────────────

function getEntryExt(fw: Framework): { mainExt: string; appExt: string } {
  return {
    react: { mainExt: "tsx", appExt: "tsx" },
    vue: { mainExt: "ts", appExt: "vue" },
    svelte: { mainExt: "ts", appExt: "svelte" },
    solid: { mainExt: "tsx", appExt: "tsx" },
  }[fw];
}

function getFrameworkFiles(
  config: ProjectConfig,
  projectName: string,
): { mainContent: string; appContent: string; aboutAppContent: string } {
  const hasTailwind = config.addons.includes("tailwind") || config.addons.includes("shadcn");
  const hasShadcn = config.addons.includes("shadcn");
  switch (config.framework) {
    case "react":
      return {
        mainContent: reactMainTsx(projectName),
        appContent: reactAppTsx(projectName, hasTailwind, hasShadcn, config.addonType),
        aboutAppContent: reactAboutAppTsx(projectName, hasTailwind, hasShadcn),
      };
    case "vue":
      return {
        mainContent: vueMainTs(projectName),
        appContent: vueAppVue(projectName, hasTailwind, config.addonType),
        aboutAppContent: vueAboutAppVue(projectName, hasTailwind),
      };
    case "svelte":
      return {
        mainContent: svelteMainTs(projectName),
        appContent: svelteAppSvelte(projectName, hasTailwind, config.addonType),
        aboutAppContent: svelteAboutAppSvelte(projectName, hasTailwind),
      };
    case "solid":
      return {
        mainContent: solidMainTsx(projectName),
        appContent: solidAppTsx(projectName, hasTailwind, config.addonType),
        aboutAppContent: solidAboutAppTsx(projectName, hasTailwind),
      };
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateClient(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  const pp = (...s: string[]) => projectPath(root, ...s);
  const hasTailwind = config.addons.includes("tailwind") || config.addons.includes("shadcn");

  // packages/shared — styles
  await writeFile(
    pp("packages", "shared", "src", "styles", "global.css"),
    hasTailwind ? globalCssTailwind : globalCssBase,
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
