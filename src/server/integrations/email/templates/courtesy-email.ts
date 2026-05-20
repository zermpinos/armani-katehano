import "@/server/_internal/node-only";
import { esc } from "./shared";

export function buildCourtesyEmailHtml(
  unsubscribeUrl: string,
  privacyUrl: string,
): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>What's new at Armani Katehano</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:#111111;padding:28px 32px;">
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">ARMANI KATEHANO &middot; WHAT'S NEW</p>
          <p style="margin:10px 0 0;font-size:22px;font-weight:900;color:#ffffff;line-height:1.3;">As Armani Katehano keeps improving</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            As the site keeps growing and improving, we've added a second kind of subscriber email. After each game you'll get a short recap with the final score, top performers, and a link to the full box score.
          </p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
            Roster announcements before each game still arrive as before.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.7;">
            You subscribed to Armani Katehano game emails.<br />
            <a href="${esc(privacyUrl)}" style="color:#6b7280;text-decoration:underline;">Privacy notice</a>
            &nbsp;&middot;&nbsp;
            <a href="${esc(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildCourtesyEmailText(
  unsubscribeUrl: string,
  privacyUrl: string,
): string {
  const lines: string[] = [];
  lines.push("ARMANI KATEHANO . WHAT'S NEW");
  lines.push("");
  lines.push("As Armani Katehano keeps improving");
  lines.push("");
  lines.push("As the site keeps growing and improving,");
  lines.push("we've added a second kind of subscriber email. After each game");
  lines.push("you'll get a short recap with the final score, top performers,");
  lines.push("and a link to the full box score.");
  lines.push("");
  lines.push("Roster announcements before each game still arrive as before.");
  lines.push("");
  lines.push("You subscribed to Armani Katehano game emails.");
  lines.push(`Privacy notice:  ${privacyUrl}`);
  lines.push(`Unsubscribe:     ${unsubscribeUrl}`);
  return lines.join("\n");
}
