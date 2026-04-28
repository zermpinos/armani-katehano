import "@/server/_internal/node-only";
export function adminHtml(opts: {
  title:       string;
  accentColor: string;
  rows:        Array<{ label: string; value: string }>;
  extra?:      string;
}): string {
  const rowsHtml = opts.rows.map(r => `
      <tr>
        <td style="padding:8px 0;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">${r.label}</p>
          <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:600;">${r.value}</p>
        </td>
      </tr>`).join("");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="el">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title} -- Armani Katehano</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#111111;padding:28px 32px;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">ARMANI KATEHANO</p>
              <p style="margin:10px 0 0;font-size:20px;font-weight:900;color:${opts.accentColor};">${opts.title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rowsHtml}
              </table>
              ${opts.extra ?? ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
