import { useState } from "react";
import { TurnstileWidget } from "./turnstile";

export function LoginForm({ onLogin, error }: { onLogin: (pw: string, captchaToken?: string | null) => Promise<{ failed: boolean; requiresCaptcha?: boolean } | void>; error: string | null }) {
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [failCount,    setFailCount]    = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const needsCaptcha = failCount >= 3;

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const result = await onLogin(password, captchaToken);
    if (result?.failed) setFailCount(c => c + 1);
    if (result?.requiresCaptcha) setCaptchaToken(null);
    setLoading(false);
  };

  return (
    <div className="w-full max-w-[360px] rounded-[20px] p-8 border border-ak-border bg-ak-surface">
      <div className="text-center mb-7">
        <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-3 text-[22px] bg-[#8b1a1a18] border border-[#8b1a1a45]">🏀</div>
        <div className="text-[22px] font-black text-ak-text">Coach Portal</div>
        <div className="text-xs text-ak-text-dim mt-1">Armani Katehano</div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-[14px]">
        <div>
          <label className="block text-[10px] font-black tracking-[0.15em] mb-[5px] text-ak-text-dim uppercase">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter coach password" autoFocus
            className="w-full py-[9px] px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none" />
        </div>
        {needsCaptcha && (
          <TurnstileWidget
            onVerified={setCaptchaToken}
            onExpired={() => setCaptchaToken(null)}
          />
        )}
        {error && <div className="text-xs text-ak-red-text">{error}</div>}
        <button type="submit" disabled={loading || !password || (needsCaptcha && !captchaToken)}
          className={[
            "py-3 font-black text-[14px] tracking-[0.12em] uppercase rounded-[10px] border-0 bg-ak-red text-ak-text font-sans",
            (loading || !password || (needsCaptcha && !captchaToken)) ? "opacity-50 cursor-not-allowed" : "cursor-pointer opacity-100",
          ].join(" ")}>
          {loading ? "VERIFYING…" : "SIGN IN"}
        </button>
      </form>
      <div className="text-center text-[10px] text-ak-text-dim mt-4">5 failed attempts → 15-minute lockout</div>
    </div>
  );
}
