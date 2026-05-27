import "@/server/_internal/node-only";
import { marked, Renderer } from "marked";
import { esc } from "./shared";

export type MarkedOutput = string & { readonly _brand: "MarkedOutput" };

export function renderMarkdown(body: string): MarkedOutput {
  const renderer = new Renderer();
  renderer.html = ({ raw }: { raw: string }) => esc(raw);
  return marked.parse(body, { renderer }) as unknown as MarkedOutput;
}

function htmlToText(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildBroadcastHtml(
  renderedBodyHtml: MarkedOutput,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Armani Katehano</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td bgcolor="#111111" style="background-color:#111111;padding:28px 32px;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">Armani Katehano</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <div style="font-size:15px;line-height:1.7;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                ${renderedBodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                You're receiving this email because you subscribed to updates from Armani Katehano.
                &nbsp;<a href="${esc(unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="${esc(appUrl)}" style="color:#9ca3af;text-decoration:underline;">Visit site</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildBroadcastText(
  renderedBodyHtml: MarkedOutput,
  appUrl: string,
  unsubscribeUrl: string,
): string {
  const body = htmlToText(renderedBodyHtml);
  return `${body}

---
You're receiving this email because you subscribed to updates from Armani Katehano.

To unsubscribe: ${unsubscribeUrl}
Visit site: ${appUrl}`;
}
