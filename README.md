# MakuNabe

Subtitle helper for Bilibili with AI summaries.

It shows subtitles, jumps by timestamp, summarizes subtitle segments with any OpenAI-compatible API, and can send the final summary to your email workflow through a webhook.

## Quick start

If you only want the shortest path to a working setup, follow this order:

1. Install the unpacked extension.

2. Open the extension options page.

3. Fill in `apiKey`, `serverUrl`, and `model`.

4. Open a Bilibili video that already has subtitles and verify `点击生成` works.

5. If you want email delivery, deploy the Cloudflare Worker example below.

6. Copy the Worker URL into `emailWebhookUrl`, then turn on `emailAutoSendEnabled`.

## Install

Load the unpacked extension from a release build.

1. Download and extract `dist.zip`.

2. Open `chrome://extensions` or `edge://extensions`.

3. Turn on Developer Mode.

4. Click `Load unpacked`.

5. Select the extracted `dist` folder.

After the extension is loaded, you can find it in:

- Chrome extensions page: `chrome://extensions`

- Edge extensions page: `edge://extensions`

## Setup

Open the extension options page:

1. Visit `chrome://extensions` or `edge://extensions`.

2. Find `MakuNabe`.

3. Click `Details`.

4. Click `Extension options`.

The options page contains the sections `OpenAI config` and `总结配置`.

Configure the required fields first:

- `apiKey`

- `serverUrl`

- `model` or `customModel`

Then open a Bilibili video with subtitles:

- Site: https://www.bilibili.com

- Example path shape: `https://www.bilibili.com/video/BV...`

Open a video page that already exposes subtitle data, then click `点击生成`.

Useful optional settings:

- `summaryStrategy`: `stable`, `balanced`, or `fast`

- `summarizeLanguage`

- `words`

- `chapterMode`

- `emailAutoSendEnabled`

- `emailRecipient`

- `emailWebhookUrl`

- `emailSubjectTemplate`

Recommended setup order inside the options page:

1. `OpenAI config`:

   - `apiKey`
   - `serverUrl`
   - `model` or `customModel`

2. `总结配置`:

   - `启用总结`
   - `总结语言`
   - `总结策略`
   - `分段字数`

3. Email-related fields:

   - `自动发邮件`
   - `默认收件人`
   - `回调地址`
   - `邮件主题模板`

## Example config

Use this as a minimal working example for the extension options page.

Replace the values marked as your own values before using it.

```text
OpenAI config

apiKey = sk-your-api-key
serverUrl = https://api.openai.com
model = gpt-4o-mini

总结配置

启用总结 = on
总结语言 = 中文简体
总结策略 = 平衡
分段字数 = 4000

邮件配置

自动发邮件 = on
默认收件人 = you@example.com
回调地址 = https://your-worker.your-subdomain.workers.dev
邮件主题模板 = [MakuNabe Summary] {{title}}
```

If you do not want email yet, start with this smaller config first:

```text
apiKey = sk-your-api-key
serverUrl = https://api.openai.com
model = gpt-4o-mini
启用总结 = on
总结语言 = 中文简体
总结策略 = 平衡
```

Field notes:

- `serverUrl`

  - OpenAI: `https://api.openai.com`
  - Gemini OpenAI-compatible endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/`

- `model`

  - If your provider supports model discovery, choose from the dropdown.
  - If your provider does not expose models, use `customModel`.

- `回调地址`

  - This must be the public Cloudflare Worker URL, not the Cloudflare dashboard URL.

## Email webhook

The extension does not send email directly.

It sends a JSON `POST` request to `emailWebhookUrl` after the full-video summary finishes. Your webhook can forward that payload to Resend, MailChannels, SendGrid, or any other provider.

Payload shape:

```json
{
  "to": "you@example.com,friend@example.com",
  "subject": "[MakuNabe Summary] Video title",
  "markdown": "## Summary\n\n...",
  "videoMeta": {
    "title": "Video title",
    "url": "https://www.bilibili.com/video/BV...",
    "author": "Channel name",
    "publishedAt": "2026-04-21 20:00:00"
  },
  "segmentsStats": {
    "total": 8,
    "success": 8,
    "failed": 0
  }
}
```

Successful responses should return:

```json
{
  "ok": true
}
```

If you want multiple recipients, separate them with commas in `emailRecipient`. Your webhook must split and handle them.

## Cloudflare Worker

This is a sanitized version of the current Worker pattern. It accepts the extension webhook payload, renders the markdown into simple HTML, and sends email through Resend.

It already supports multiple recipients by splitting `to` on commas.

Deployment path:

1. Open the Cloudflare dashboard: https://dash.cloudflare.com

2. Go to `Workers & Pages`.

3. Click `Create application` or `Create`.

4. Create a Worker and paste the code below.

5. Add the Worker secrets `RESEND_API_KEY` and `MAIL_FROM`.

6. Deploy the Worker.

7. Copy the Worker URL, for example `https://your-worker.your-subdomain.workers.dev`.

8. Paste that URL into the extension field `emailWebhookUrl`.

This example assumes you use Resend as the email provider. Before deploying the Worker, prepare these in the Resend dashboard:

- API keys page: https://resend.com/api-keys

- Domains page: https://resend.com/domains

Your `MAIL_FROM` must use a sender address that Resend accepts for your verified domain.

```ts
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405)
    }

    try {
      const body = await request.json()
      const { to, subject, markdown, videoMeta, segmentsStats } = body ?? {}

      if (!to || !subject || !markdown) {
        return json({ ok: false, error: 'Missing required fields' }, 400)
      }

      const summaryHtml = markdownToHtml(String(markdown))
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:#111827;">
          <h2 style="margin:0 0 12px;">Video Summary</h2>
          <p style="margin:4px 0;"><b>Title:</b> ${escapeHtml(videoMeta?.title ?? '')}</p>
          <p style="margin:4px 0;"><b>URL:</b> <a href="${escapeHtml(videoMeta?.url ?? '')}">${escapeHtml(videoMeta?.url ?? '')}</a></p>
          <p style="margin:4px 0;"><b>Author:</b> ${escapeHtml(videoMeta?.author ?? '')}</p>
          <p style="margin:4px 0;"><b>Published At:</b> ${escapeHtml(videoMeta?.publishedAt ?? '')}</p>
          <p style="margin:4px 0;"><b>Segments:</b> total=${segmentsStats?.total ?? 0}, success=${segmentsStats?.success ?? 0}, failed=${segmentsStats?.failed ?? 0}</p>
          <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;" />
          <div>${summaryHtml}</div>
        </div>
      `

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: to.split(',').map((item) => item.trim()).filter(Boolean),
          subject,
          html,
          text: String(markdown),
        }),
      })

      const data = await resp.json()
      if (!resp.ok) {
        return json({ ok: false, error: data?.message ?? 'Resend send failed' }, 500)
      }

      return json({ ok: true, requestId: data?.id ?? '' }, 200)
    } catch (error) {
      return json({ ok: false, error: String(error) }, 500)
    }
  },
}

function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n')
  const out = []
  let inList = false

  const inline = (text) => {
    let s = escapeHtml(text)
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
    s = s.replace(/`(.+?)`/g, '<code>$1</code>')
    return s
  }

  for (const raw of lines) {
    const line = raw.trim()

    if (!line) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      continue
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul style="margin:8px 0 8px 20px;padding:0;">')
        inList = true
      }
      out.push(`<li style="margin:4px 0;">${inline(line.slice(2))}</li>`)
      continue
    }

    if (inList) {
      out.push('</ul>')
      inList = false
    }

    if (line.startsWith('### ')) {
      out.push(`<h3 style="margin:12px 0 6px;">${inline(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      out.push(`<h2 style="margin:14px 0 8px;">${inline(line.slice(3))}</h2>`)
    } else if (line.startsWith('# ')) {
      out.push(`<h1 style="margin:16px 0 10px;">${inline(line.slice(2))}</h1>`)
    } else {
      out.push(`<p style="margin:8px 0;">${inline(line)}</p>`)
    }
  }

  if (inList) out.push('</ul>')
  return out.join('')
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
```

Set the following Worker bindings or secrets:

- `RESEND_API_KEY`

- `MAIL_FROM`

After deployment, your final mapping should look like this:

- Resend dashboard:

  - create API key at `https://resend.com/api-keys`
  - verify sender domain at `https://resend.com/domains`

- Cloudflare dashboard:

  - deploy the Worker at `https://dash.cloudflare.com`
  - set `RESEND_API_KEY`
  - set `MAIL_FROM`
  - copy the public Worker URL

- MakuNabe options page:

  - `默认收件人` = your target inbox, or multiple emails separated by commas
  - `回调地址` = your Worker URL
  - `自动发邮件` = on
  - `邮件主题模板` = optional

## Verify the flow

Use this checklist after setup:

1. Open `chrome://extensions` or `edge://extensions`.

2. Enter `MakuNabe` -> `Details` -> `Extension options`.

3. Confirm `apiKey`, `serverUrl`, and `model` are filled in.

4. Confirm `emailWebhookUrl` is your live Worker URL.

5. Confirm `emailRecipient` is not empty if email is enabled.

6. Visit a subtitle-enabled Bilibili video page.

7. Click `点击生成`.

8. Wait for the full-video summary to finish.

9. If `emailAutoSendEnabled` is on, the extension sends the final merged markdown to your Worker only after the summary is fully completed.

## Notes

- `balanced` is the default strategy.

- Summary jobs run in the extension background, so closing the page does not immediately stop them.

- The extension keeps summary sessions for retries and recovery, then removes old sessions with retention rules.

## Troubleshooting

- No subtitles: the video may not provide subtitle data.

- Model discovery fails: check `serverUrl`, `apiKey`, and `GET /models` support.

- Summary fails: reduce `words` or switch to `stable`.

- Webhook fails: confirm the endpoint accepts JSON `POST` and returns `{ "ok": true }`.

## Development

```bash
npm install
npm run build
```

Load the unpacked extension from `dist`.

## License

MIT
