# MakuNabe (Bazinga Fork)

MakuNabe is a subtitle helper extension for Bilibili.

This fork focuses on practical daily use: subtitle browsing, AI summary, and easy configuration transfer.

## Features

- Show subtitle list and jump to exact timestamps

- Generate segment summaries with OpenAI-compatible APIs

- Discover available models from your configured endpoint

- Copy or export subtitle/summary content

- Import and export encrypted extension configuration

- Auto-send summary email through a webhook (optional)

## For Users (GitHub Release)

### Install from Release

1. Download the latest release asset (recommended: `dist.zip`).

2. Extract it to a local folder.

3. Open `chrome://extensions` (or `edge://extensions`), enable Developer Mode, then click `Load unpacked`.

4. Select the extracted `dist` folder.

### 3-Minute Minimum Setup

Open the extension options page and configure the required fields:

- `apiKey`: your API key for the selected service

- `serverUrl`: API base URL (for OpenAI, use `https://api.openai.com`)

- `model`: click `Refresh Models`, then select one discovered model

Click `Save`, open a Bilibili video with subtitles, and trigger summary to verify everything works.

### Required vs Optional Configuration

Required for AI summary:

- `apiKey`

- `serverUrl`

- `model` (or `customModel`)

Optional for better experience:

- `theme`, `fontSize`, side panel behavior

- summary language, segment words, custom prompts

- `emailAutoSendEnabled`, `emailRecipient`, `emailWebhookUrl`, `emailSubjectTemplate`

- encrypted config import/export

### Common Endpoint Examples

OpenAI:

- `serverUrl`: `https://api.openai.com`

Local Ollama:

```bash
OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*,safari-web-extension://*
```

- `serverUrl`: `http://localhost:11434`

- `model`: refresh and pick one discovered model (or type a custom model name)

## Troubleshooting

### Model discovery failed

- Check `serverUrl` and `apiKey`.

- Confirm the endpoint supports `GET /models`.

- Try opening the endpoint from your browser to verify connectivity.

### Summary failed

- Confirm the selected model supports chat completion.

- Reduce segment words if token-related errors appear.

- Re-run with a smaller video segment for quick validation.

### Webhook email failed

- Verify `emailWebhookUrl` is reachable and accepts JSON `POST`.

- Check your webhook response includes success semantics expected by this extension.

### Video has no subtitle panel

- The video may not provide subtitles.

- Refresh the page and re-open the extension.

- Confirm the page URL matches `https://*.bilibili.com/*`.

### Network or permission related errors

- This release uses broad host permission to support OpenAI-compatible endpoints and webhook URLs out of the box.

- If you modified `manifest.json`, ensure your target domain is still permitted.

## For Developers

### Requirements

- Node.js `18.15.0`

- `pnpm`

### Build and Load

```bash
pnpm install
pnpm run build
```

Load the unpacked extension from `dist`.

### Local Development

```bash
pnpm run dev
```

If subtitle panel injection fails with CSP-like behavior during development, check `dist/manifest.json` and keep `web_accessible_resources[*].use_dynamic_url` as `false`.

## Release Notes and Artifacts

Each release should include:

- `dist.zip` (ready for users to load unpacked)

- release notes summary

- known issues section

- compatibility or migration note (if configuration behavior changes)

Write release notes directly in the GitHub Release description.

## Credits

This project is based on the original open-source work by `IndieKKY`, and is maintained as a personal fork with custom changes.

## License

MIT
