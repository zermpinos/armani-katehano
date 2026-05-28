import { useState, useEffect, useCallback } from "react";
import { useRouter }                         from "next/router";
import {
  AdminLayout,
  Spinner,
  PasskeyLoginForm,
  useAdminAuth,
  apiFetch,
  Confirm,
}                                            from "@/client/admin";
import { getAdminPasskeyLoginProps }         from "@/server/auth";

type CredentialRow = {
  id:         string;
  label:      string;
  createdAt:  string;
  lastUsedAt: string | null;
  transports: string[];
};

export default function PasskeysPage({
  validSlug,
  showFallback,
  noPasskeys: initialNoPasskeys,
}: {
  validSlug:    boolean;
  showFallback: boolean;
  noPasskeys:   boolean;
}) {
  const router = useRouter();
  const slug   = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } =
    useAdminAuth(slug);

  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [toast,       setToast]       = useState<{ type?: string; msg: string } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [labelInput,  setLabelInput]  = useState("");
  const [confirmMsg,  setConfirmMsg]  = useState<string | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [noPasskeys,  setNoPasskeys]  = useState(initialNoPasskeys);

  const loadCredentials = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await apiFetch("/api/admin/passkeys");
      if (res.ok) {
        const rows = await res.json();
        setCredentials(rows);
        setNoPasskeys(rows.length === 0);
      }
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadCredentials();
  }, [authed, loadCredentials]);

  if (!validSlug) return null;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ak-base">
        <Spinner />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
        <PasskeyLoginForm
          onPasskeyLogin={handlePasskeyLogin}
          onFallbackLogin={handleLogin}
          loginError={loginError}
          showFallback={showFallback}
          noPasskeys={noPasskeys}
        />
      </div>
    );
  }

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const optRes = await apiFetch("/api/auth/passkey/register-options", { method: "POST" });
      if (!optRes.ok) {
        setToast({ type: "error", msg: "Failed to start registration" });
        return;
      }
      const { options, challengeId } = await optRes.json();

      const { startRegistration } = await import("@simplewebauthn/browser");
      const response = await startRegistration({ optionsJSON: options });

      const label = labelInput.trim() || "My passkey";
      setLabelInput("");

      const verRes = await apiFetch("/api/auth/passkey/register-verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ challengeId, response, label }),
      });

      if (verRes.ok) {
        setToast({ type: "success", msg: `Passkey "${label}" registered` });
        loadCredentials();
      } else {
        const body = await verRes.json().catch(() => ({}));
        setToast({ type: "error", msg: body.error ?? "Registration failed" });
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "NotAllowedError") {
        setToast({ type: "error", msg: "Registration failed. Try again." });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await apiFetch("/api/admin/passkeys", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    if (res.ok) {
      setToast({ type: "success", msg: "Passkey deleted" });
      loadCredentials();
    } else {
      setToast({ type: "error", msg: "Delete failed" });
    }
    setConfirmId(null);
    setConfirmMsg(null);
  };

  const openConfirm = (cred: CredentialRow) => {
    setConfirmId(cred.id);
    setConfirmMsg(
      credentials.length === 1
        ? "This is your last passkey. Deleting it means you can only sign in using the password recovery token. Continue?"
        : "Delete this passkey?"
    );
  };

  const transportLabel = (transports: string[]) => {
    if (transports.includes("internal"))    return "Built-in";
    if (transports.includes("usb"))         return "USB key";
    if (transports.includes("hybrid"))      return "Phone";
    return transports.join(", ") || "Unknown";
  };

  const inputCls = "py-[9px] px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none";
  const btnCls   = "py-2 px-4 font-black text-[12px] tracking-[0.1em] uppercase rounded-lg border-0 cursor-pointer";

  return (
    <AdminLayout slug={slug} title="Passkeys" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <div className="max-w-[600px]">
        <h1 className="text-[20px] font-black text-ak-text mb-6">Passkeys</h1>

        {/* Registered passkeys */}
        <div className="mb-8">
          <div className="text-[11px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-3">
            Registered passkeys
          </div>
          {listLoading ? (
            <Spinner />
          ) : credentials.length === 0 ? (
            <div className="text-[13px] text-ak-text-dim">No passkeys registered yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between rounded-xl px-4 py-3 border border-ak-border bg-ak-surface"
                >
                  <div>
                    <div className="text-[13px] font-black text-ak-text">{cred.label}</div>
                    <div className="text-[11px] text-ak-text-dim">
                      {transportLabel(cred.transports)} · Added{" "}
                      {new Date(cred.createdAt).toLocaleDateString()}
                      {cred.lastUsedAt && (
                        <> · Last used {new Date(cred.lastUsedAt).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openConfirm(cred)}
                    className={`${btnCls} bg-[#8b1a1a22] text-ak-red-text border border-[#8b1a1a45]`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add passkey */}
        <div className="border border-ak-border rounded-xl p-5 bg-ak-surface">
          <div className="text-[11px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-3">
            Register new passkey
          </div>
          <div className="flex gap-2 items-center mb-3">
            <input
              type="text"
              placeholder="Label (e.g. MacBook, iPhone)"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              maxLength={100}
              className={`${inputCls} flex-1`}
            />
          </div>
          <button
            onClick={handleRegister}
            disabled={registering}
            className={`${btnCls} bg-ak-red text-ak-text ${registering ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {registering ? "WAITING..." : "ADD PASSKEY"}
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      <Confirm
        msg={confirmMsg}
        onConfirm={() => confirmId && handleDelete(confirmId)}
        onCancel={() => { setConfirmId(null); setConfirmMsg(null); }}
      />
    </AdminLayout>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: Record<string, string | string[] | undefined> }) {
  return getAdminPasskeyLoginProps(params, query);
}
