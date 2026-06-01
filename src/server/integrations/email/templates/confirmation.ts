import "@/server/_internal/node-only";
import { esc } from "./shared";

export function buildConfirmationEmailHtml(confirmUrl: string, appUrl: string): string {
  const safeConfirm = esc(confirmUrl);
  const privacyUrl  = esc(`${appUrl}/privacy`);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your subscription - Armani Katehano</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <!--[if mso]><table width="100%"><tr><td><![endif]-->

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Confirm your email to receive Armani Katehano game emails.</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td bgcolor="#111111" style="background-color:#111111;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;width:60px;">
                    <img src="${esc(appUrl)}/logohighres.png" width="52" height="52" border="0"
                         style="display:block;width:52px;height:52px;" alt="Armani Katehano" />
                  </td>
                  <td style="padding-left:16px;vertical-align:middle;">
                    <p style="margin:0;font-size:15px;font-weight:900;color:#ffffff;">Armani Katehano</p>
                    <p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#c92a2a;">Confirm your subscription</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Click the button below to confirm your email address and start receiving Armani Katehano game emails - roster announcements before games and recaps after.
              </p>
              <a href="${safeConfirm}"
                 style="display:inline-block;padding:12px 28px;background:#c92a2a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">
                Confirm subscription
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.7;">
                If you did not request this, you can ignore this email - your address will not be subscribed.<br />
                This link is valid for 24 hours.<br />
                <a href="${privacyUrl}" style="color:#6b7280;text-decoration:underline;">Privacy notice</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

export function buildConfirmationEmailText(confirmUrl: string, appUrl: string): string {
  const lines: string[] = [];
  lines.push("ARMANI KATEHANO");
  lines.push("Confirm your subscription");
  lines.push("");
  lines.push("Click the link below to confirm your email address and start receiving");
  lines.push("Armani Katehano game emails - roster announcements before games and recaps after.");
  lines.push("");
  lines.push(confirmUrl);
  lines.push("");
  lines.push("If you did not request this, you can ignore this email.");
  lines.push("This link is valid for 24 hours.");
  lines.push("");
  lines.push(`Privacy notice  ${appUrl}/privacy`);
  return lines.join("\n");
}
