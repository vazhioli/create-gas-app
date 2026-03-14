# Changelog

## [1.1.0](https://vazhioli-github/vazhioli/create-gas-app/compare/v0.4.2...v1.1.0) (2026-03-14)

### Features

* add error state and try/catch to all framework App templates (React, Vue, Svelte, Solid) ([1060a1c](https://vazhioli-github/vazhioli/create-gas-app/commit/1060a1c84a4fb4a4b26cba0150cd843a859cfe58))
* add type-check script (tsc --noEmit) to generated project ([3e3b24a](https://vazhioli-github/vazhioli/create-gas-app/commit/3e3b24a85530c2a501222f178135431d1e82bba1))
* add Vanilla (HTML + CSS + TypeScript) as a framework option ([e42ecdf](https://vazhioli-github/vazhioli/create-gas-app/commit/e42ecdf8c409cda864e3fba8de816ff2da6f560c))
* auto-register new dialog in vite.config.ts entrypoints when using add dialog command ([c1b996d](https://vazhioli-github/vazhioli/create-gas-app/commit/c1b996d9fd7e9649e23c060541b5ec3655cd355a))
* combine install deps and git init into single setup options multi-select ([00df6ad](https://vazhioli-github/vazhioli/create-gas-app/commit/00df6ad7bd56ada65651f123efc3ee112c49845c))
* detect package manager from lockfiles in cwd and parent directories ([ffa9dfd](https://vazhioli-github/vazhioli/create-gas-app/commit/ffa9dfd79fe4fcb8ccaeca43b86b38ce0e0034db))
* filter shadcn/ui addon to React only and use detected package manager as default ([e733c71](https://vazhioli-github/vazhioli/create-gas-app/commit/e733c71912dfa03b46650e59843a5d0f184d675c))
* generate .vscode/settings.json and extensions.json with framework-aware config ([aa3f0d6](https://vazhioli-github/vazhioli/create-gas-app/commit/aa3f0d61d15ece11472a30f82af7d6b053c17b66))
* generate env.example.ts alongside gitignored env.ts in server package ([3ba426b](https://vazhioli-github/vazhioli/create-gas-app/commit/3ba426b9053977473caf63da2b6113f37322c70f))
* generate pnpm-workspace.yaml when pnpm is selected as package manager ([9c731f1](https://vazhioli-github/vazhioli/create-gas-app/commit/9c731f1e7c02a3691ea7580e6454762f97c99562))
* generate README.md with project structure, dev workflow, and clasp setup steps ([49aa6b0](https://vazhioli-github/vazhioli/create-gas-app/commit/49aa6b0035a68cdd476bd6fc37fc3730837318f6))
* show pre-configured GAS type in clasp:create next steps message ([8c94625](https://vazhioli-github/vazhioli/create-gas-app/commit/8c946257d31d63227bc7e4e7eeee9264e25a61c7))

### Bug Fixes

* add background-color to generated global CSS ([8d0e409](https://vazhioli-github/vazhioli/create-gas-app/commit/8d0e409617b743d6aa1d19e0b4a9d404daee6180)), closes [#ffffff](https://vazhioli-github/vazhioli/create-gas-app/issues/ffffff)
* conditional prepare script, pnpm workspaces, vite dedupe cleanup ([6929ed3](https://vazhioli-github/vazhioli/create-gas-app/commit/6929ed3cb690bfb6f752d7fe460c37905145475c))
* vanilla about dialog import + git user config check ([350b64f](https://vazhioli-github/vazhioli/create-gas-app/commit/350b64fd4bc8e98d384483cf870e4de2b85f297f))
