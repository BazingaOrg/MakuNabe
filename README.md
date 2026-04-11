# Bilibili Subtitle (Bazinga Fork)

这是我基于原项目做的个人 fork 版本。

目标很直接：在 B 站看视频时，能更快看字幕、做总结、导出内容，减少来回切页面的成本。

## What It Does

- Show subtitle list and jump to the exact timestamp
- Generate summary from subtitle segments with AI
- Copy or export subtitles in multiple formats
- Configure OpenAI-compatible models (including custom endpoints)
- Auto-send summary by webhook after all segments are done (optional)

## Quick Start

### 1) Requirements

- Node.js `18.15.0`
- `pnpm`

### 2) Install

```bash
pnpm install
```

### 3) Dev

```bash
pnpm run dev
```

Then open browser extension management page, enable developer mode, and load unpacked extension from `dist`.

### 4) Build

```bash
pnpm run build
```

After build, load unpacked extension from `dist`.

## AI Setup

Open extension options page and configure:

- `apiKey`
- `serverUrl`
- `model` (or custom model)

For local Ollama, set:

```bash
OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*,safari-web-extension://*
```

Then use:

- `serverUrl`: `http://localhost:11434`
- `model`: choose from discovered models or input custom model name

## Notes

- If subtitle panel does not load during dev and browser reports CSP errors, check `dist/manifest.json` and ensure `web_accessible_resources[*].use_dynamic_url` is `false`, then reload the extension.
- `push.sh` is a personal helper script and can be ignored.

## Credits

This project is based on the original open-source work by `IndieKKY`, and now maintained as a personal fork with custom changes.

## License

MIT
