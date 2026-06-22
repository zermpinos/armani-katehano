import { useEffect, useRef } from "react";

export function TurnstileWidget({ onVerified, onExpired }: { onVerified: (token: string) => void; onExpired: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    const render = () => {
      const ts = (window as any).turnstile;
      if (containerRef.current && ts && !widgetId.current) {
        widgetId.current = ts.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerified,
          "expired-callback": onExpired,
          theme: "dark",
        });
      }
    };

    if ((window as any).turnstile) {
      render();
    } else {
      const existing = document.getElementById("cf-turnstile-script");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = render;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", render);
      }
    }

    return () => {
      if (widgetId.current && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={containerRef} className="my-1" />;
}
