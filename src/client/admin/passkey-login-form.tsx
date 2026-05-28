import { useState } from "react";
import { LoginForm }        from "./login-form";

type Props = {
  onPasskeyLogin: () => Promise<{ failed: boolean; error?: string }>;
  onFallbackLogin: Parameters<typeof LoginForm>[0]["onLogin"];
  loginError:      string | null;
  showFallback:    boolean;
  noPasskeys:      boolean;
};

export function PasskeyLoginForm({
  onPasskeyLogin,
  onFallbackLogin,
  loginError,
  showFallback,
  noPasskeys,
}: Props) {
  const [loading,   setLoading]   = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleClick = async () => {
    setCancelled(false);
    setLoading(true);
    const result = await onPasskeyLogin();
    if (result.error === "cancelled") setCancelled(true);
    setLoading(false);
  };

  if (showFallback) {
    return <LoginForm onLogin={onFallbackLogin} error={loginError} />;
  }

  return (
    <div className="w-full max-w-[360px] rounded-[20px] p-8 border border-ak-border bg-ak-surface">
      <div className="text-center mb-7">
        <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-3 text-[22px] bg-[#8b1a1a18] border border-[#8b1a1a45]">🔐</div>
        <div className="text-[22px] font-black text-ak-text">Admin Access</div>
        <div className="text-xs text-ak-text-dim mt-1">Armani Katehano · Team Manager</div>
      </div>

      {noPasskeys && (
        <div className="text-xs text-ak-text-dim mb-4 text-center">
          No passkeys registered. Use the password recovery token to sign in and register one.
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={loading}
        className={[
          "w-full py-3 font-black text-[14px] tracking-[0.12em] uppercase rounded-[10px] border-0 bg-ak-red text-ak-text font-sans",
          loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer opacity-100",
        ].join(" ")}
      >
        {loading ? "WAITING FOR PASSKEY..." : "SIGN IN WITH PASSKEY"}
      </button>

      {cancelled && (
        <div className="text-xs text-ak-text-dim mt-3 text-center">Sign-in cancelled.</div>
      )}
      {loginError && !cancelled && (
        <div className="text-xs text-ak-red-text mt-3 text-center">{loginError}</div>
      )}
    </div>
  );
}
