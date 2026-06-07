import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/router";
import {
  AdminLayout,
  Spinner,
  PasskeyLoginForm,
  Btn,
  Confirm,
  useAdminAuth,
  apiFetch,
} from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";

type CredentialRow = {
  id:         string;
  label:      string;
  createdAt:  string;
  lastUsedAt: string | null;
  transports: string[];
};

function transportLabel(transports: string[]): string {
  if (transports.includes("internal")) return "Built-in";
  if (transports.includes("usb"))      return "USB key";
  if (transports.includes("hybrid"))   return "Phone";
  return transports.join(", ") || "Unknown";
}

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
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [toast,       setToast]       = useState<{ type?: string; msg: string } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [labelInput,  setLabelInput]  = useState("");
  const [confirmCred, setConfirmCred] = useState<CredentialRow | null>(null);
  const [noPasskeys,  setNoPasskeys]  = useState(initialNoPasskeys);

  const loadCredentials = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await apiFetch("/api/admin/passkeys");
      if (res.ok) {
        const rows: CredentialRow[] = await res.json();
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
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );
  if (!authed) return (
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
      // NotAllowedError = user cancelled the browser prompt; not a real failure.
      if ((err as { name?: string })?.name !== "NotAllowedError") {
        setToast({ type: "error", msg: "Registration failed. Try again." });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmCred) return;
    const res = await apiFetch("/api/admin/passkeys", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: confirmCred.id }),
    });
    if (res.ok) {
      setToast({ type: "success", msg: "Passkey deleted" });
      loadCredentials();
    } else {
      setToast({ type: "error", msg: "Delete failed" });
    }
    setConfirmCred(null);
  };

  return (
    <AdminLayout slug={slug} title="Passkeys" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">Passkeys</h1>

      <div className="flex flex-col gap-5 max-w-[720px]">
        <Panel
          label="Registered"
          hint="Each passkey is bound to one device. Removing all of them falls back to password sign-in."
        >
          {listLoading ? (
            <PasskeySkeleton />
          ) : credentials.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-ak-text-dim">
              No passkeys registered yet. Add one below to enable one-tap sign-in.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {credentials.map(cred => (
                <li key={cred.id}>
                  <article className="flex items-center justify-between gap-3 flex-wrap rounded-[9px] border border-ak-border bg-ak-base px-3 md:px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-black text-ak-text truncate">{cred.label}</div>
                      <div className="text-[11px] text-ak-text-dim mt-0.5">
                        {transportLabel(cred.transports)} · Added {new Date(cred.createdAt).toLocaleDateString()}
                        {cred.lastUsedAt && (
                          <> · Last used {new Date(cred.lastUsedAt).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <Btn size="sm" variant="danger" onClick={() => setConfirmCred(cred)}>
                      DELETE
                    </Btn>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          label="Register a new passkey"
          hint='Pick a label that identifies the device, like "MacBook" or "iPhone".'
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Device label"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              maxLength={100}
              className="flex-1 py-[9px] px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
            />
            <Btn onClick={handleRegister} disabled={registering}>
              {registering ? "WAITING..." : "ADD PASSKEY"}
            </Btn>
          </div>
        </Panel>
      </div>

      {confirmCred && (
        <Confirm
          msg={
            credentials.length === 1
              ? `"${confirmCred.label}" is your last passkey. Deleting it forces password sign-in until you register another. Proceed?`
              : `Delete "${confirmCred.label}"?`
          }
          onConfirm={handleDelete}
          onCancel={() => setConfirmCred(null)}
        />
      )}
    </AdminLayout>
  );
}

function Panel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-1">{label}</div>
      {hint && <div className="text-[11px] text-ak-text-dim mb-3 leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function PasskeySkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1].map(i => (
        <li key={i} className="rounded-[9px] border border-ak-border bg-ak-base h-[58px] animate-pulse" />
      ))}
    </ul>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: Record<string, string | string[] | undefined> }) {
  return getAdminPasskeyLoginProps(params, query);
}
