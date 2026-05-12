# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

MakuNabe is a Chrome MV3 extension that enhances Bilibili video pages with subtitle viewing, timestamp jumping, AI segment summarization via OpenAI-compatible APIs, and optional email delivery through a webhook. Primary user-facing surfaces are an injected iframe on `https://*.bilibili.com/*`, an optional side panel, and an options page.

Stack: TypeScript + React 18 + Redux Toolkit + Vite 3 + `@crxjs/vite-plugin` + Tailwind/daisyUI + less.

Node: `22.14.0` (see `.nvmrc`). Uses npm, packageManager pinned to `npm@10.9.2`.

## Commands

```bash
nvm use
npm ci
npm run dev     # Vite dev server (HMR for extension via @crxjs)
npm run build   # tsc (type-check) + vite build + node fix.cjs
npm run fix     # eslint --fix --quiet .
```

No test runner is configured.

`fix.cjs` is a mandatory post-build step: it copies `dist/index.html` to `dist/sidepanel.html` and rewrites `manifest.json` to force `use_dynamic_url: false` on every `web_accessible_resources` entry. Do not skip it; skipping breaks the side-panel entry and iframe loading on Bilibili.

Load the unpacked extension from `dist/` in `chrome://extensions` (Developer Mode).

Path alias: `@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

## Architecture

The extension has four runtime contexts that must stay in sync. Changes often span multiple contexts.

1. **Background service worker** — `src/chrome/background.ts` plus the `src/chrome/*Service.ts` modules. Owns long-running work: task queue/heartbeat (`taskService`), OpenAI requests (`openaiService`), summary session persistence and lifecycle (`summarySessionService`), email webhook delivery with alarm-based retry (`summaryEmailService`), and encrypted API-key storage (`secretService`). Summary jobs continue here after the page/side-panel closes.
2. **Content script (`inject`)** — `src/inject/inject.ts`. Runs on Bilibili pages, fetches video metadata and subtitles from `api.bilibili.com`, creates/resizes the iframe inside `#danmukuBox`, proxies video controls (seek/play/pause), and pushes `SET_VIDEO_INFO` / `SET_INFOS` events to the app.
3. **App UI (iframe or side panel)** — React app rooted at `index.html` (copied to `sidepanel.html` by `fix.cjs`). `src/Router.tsx` dispatches on `window.location.pathname` to render either `MainPage` (iframe/sidepanel) or `OptionsPage` (`options.html`). Redux state lives in `src/store.ts` with slices `env` (user config + current video state) and `currentTime`.
4. **Options page** — same React bundle, different path. Handles API key entry, model discovery, summary/email settings.

### Messaging

All cross-context RPC goes through `src/message/`, a two-layer protocol:

- **Layer 1** (`layer1/Layer1Protocol.ts`): request/response over `chrome.runtime.Port` with UUID correlation, 30s timeout, and auto-dispose on disconnect.
- **Layer 2** (`layer2/ExtensionMessaging.ts`, `InjectMessaging.ts`, plus `useMessaging*` hooks): typed senders/receivers keyed by `method` names.

Message schemas live in `src/message-typings.d.ts` as three discriminated unions: `AllExtensionMessages` (→ background), `AllInjectMessages` (→ content script), `AllAPPMessages` (→ React app). When adding a new RPC, you must extend the typing union AND register the handler in the matching `methods` map (`background.ts` for extension messages, `inject.ts` for inject messages, React hooks for app messages). Missing handlers silently fail at runtime because the type is only enforced on the dispatcher side.

### Summary flow (the core feature)

User clicks 点击生成 → MainPage splits the transcript into segments based on `envData.words` and `SUMMARY_STRATEGIES[strategy]` → one `ADD_TASK` per segment to background → `taskService` persists each task under `makunabe_task:<id>` in `chrome.storage.local` with a heartbeat → `openaiService` streams/completes against `envData.serverUrl` → per-segment summary results feed back to the app → after all segments succeed, `summarySessionService` produces a merged `videoSummary` → if `emailAutoSendEnabled`, `summaryEmailService` POSTs to `envData.emailWebhookUrl`, using `chrome.alarms` to retry on failure. Sessions are retained for `SUMMARY_SESSION_RETENTION_MS` (7 days, capped at `SUMMARY_SESSION_MAX_COUNT` = 50).

Strategies (`stable` / `balanced` / `fast`) are defined in `src/consts/const.ts` and control temperature, streaming, auto-retry, and JSON auto-repair. `balanced` is the default.

### State and storage

- `chrome.storage.sync` keys: `STORAGE_ENV` (`makunabe_env`, user config — synced across devices) and `STORAGE_TEMP` (`makunabe_temp`, ephemeral UI state). Serialized as JSON strings.
- `chrome.storage.local`: task records (`makunabe_task:*`) and summary sessions.
- API keys go through `secretService.ts` — never read/write `envData.apiKey` directly from the app side; always use `GET_API_SECRET_STATUS` / `SET_API_SECRET` RPCs. Stored tasks strip `apiKey` from `extra` before persisting (`toStoredTask` in `taskService.ts`).
- `sanitizeEnvData` / `sanitizeTempData` in `src/utils/envSanitizer.ts` normalize persisted data on load; extend them when adding fields to `EnvData` / `TempData` (declared in `src/typings.d.ts`).

### Manifest

Defined programmatically in `manifest.config.ts` — version derives from `package.json`. Permissions: `sidePanel`, `storage`, `alarms`; host permissions `<all_urls>`. Content script target is `https://*.bilibili.com/*`. `options_page` is `options.html`; background is ES module `src/chrome/background.ts`.

## Conventions

- `eslint-config-standard-with-typescript`. Run `npm run fix` before committing.
- Commit messages are conventional (`feat:`, `fix:`, `refactor:`) and often in Chinese — match the surrounding history.
- `EnvData`, `TempData`, `Task`, `Summary`, `Segment`, `Transcript`, etc. are ambient types in `src/typings.d.ts`; keep them authoritative when changing shapes.
- CSS: Tailwind + daisyUI themes (`light`/`dark`, driven by `envData.theme`); less modules with `camelCase` locals (`vite.config.ts` → `css.modules.localsConvention`).
