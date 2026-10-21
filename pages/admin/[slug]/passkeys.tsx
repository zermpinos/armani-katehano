import { useRef, useState, type ReactNode } from "react";
import type { GetServerSidePropsContext } from "next";
import {
  adminLayout, useAdminSession, useAdminData, apiFetch, sendForResult,
  Btn, F, ArmedButton, ListRow, BottomSheet, SheetError,
} from "@/client/admin";
import { getAdminPageProps } from "@/server/auth";
import { fmtDate } from "@/domain/shared/format";

const URL_ = "/api/admin/passkeys";

type CredentialRow = {
  id:         string;
  label:      string;
  createdAt:  string;
  lastUsedAt: string | null;
  transports: string[];
};

type Sheet = { cred: CredentialRow; error: string | null; openCount: number };

const jsonInit = (method: string, body: unknown) =>
  ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function transportLabel(transports: string[]): string {
  if (transports.includes("internal")) return "Built-in";
  if (transports.includes("usb"))      return "USB key";
  if (transports.includes("hybrid"))   return "Phone";
  return transports.join(", ") || "Unknown";
}

export default function PasskeysPage() {
  const { setToast } = useAdminSession();
  const { data, error, refresh } = useAdminData<CredentialRow[]>(URL_);
  const credentials = data ?? [];
  const [registering, setRegistering] = useState(false);
  const [labelInput,  setLabelInput]  = useState("");
  const [sheet,       setSheet]       = useState<Sheet | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const opens = useRef(0);

  const open = (cred: CredentialRow) => {
    opens.current += 1;
    setSheet({ cred, error: null, openCount: opens.current });
  };

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
      const verRes = await apiFetch("/api/auth/passkey/register-verify", jsonInit("POST", { challengeId, response, label }));
      if (verRes.ok) {
        setToast({ type: "success", msg: `Passkey "${label}" registered` });
        void refresh();
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

  // Passkeys change rarely, so a delete waits for the server instead of updating the list ahead of it.
  const remove = async () => {
    if (!sheet) return;
    const current = sheet;
    setDeleting(true);
    const result = await sendForResult(() => apiFetch(URL_, jsonInit("DELETE", { id: current.cred.id })), "Delete failed");
    setDeleting(false);
    if (result.ok) {
      setSheet(null);
      setToast({ msg: "Passkey deleted.", type: "success" });
      void refresh();
      return;
    }
    // The sheet is a modal dialog above the sign-in overlay, so a 401 closes it.
    if (result.status === 401) { setSheet(null); return; }
    setSheet(s => (s && s.openCount === current.openCount ? { ...s, error: result.message } : s));
  };

  return (
    <>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">Passkeys</h1>

      <div className="flex flex-col gap-5 max-w-[720px]">
        <Panel
          label="Registered"
          hint="Each passkey is bound to one device. Removing all of them falls back to password sign-in."
        >
          {data === undefined && !error ? (
            <PasskeySkeleton />
          ) : data === undefined ? (
            <div className="py-6 text-center">
              <div className="mb-3 text-[12px] text-ak-text-dim">Could not load passkeys.</div>
              <Btn size="sm" onClick={() => void refresh()}>Retry</Btn>
            </div>
          ) : credentials.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-ak-text-dim">
              No passkeys registered yet. Add one below to enable one-tap sign-in.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {credentials.map(cred => (
                <li key={cred.id}>
                  <ListRow onClick={() => open(cred)}>
                    <div className="truncate text-[15px] font-black text-ak-text">{cred.label}</div>
                    <div className="mt-0.5 text-[12px] text-ak-text-dim">
                      {transportLabel(cred.transports)} · Added {fmtDate(cred.createdAt)}
                    </div>
                  </ListRow>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          label="Register a new passkey"
          hint='Pick a label that identifies the device, like "MacBook" or "iPhone".'
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <F label="DEVICE LABEL" value={labelInput} onChange={setLabelInput} placeholder="Device label" maxLength={100} />
            </div>
            <Btn onClick={handleRegister} disabled={registering}>
              {registering ? "WAITING..." : "ADD PASSKEY"}
            </Btn>
          </div>
        </Panel>
      </div>

      <BottomSheet
        open={sheet !== null}
        resetKey={sheet?.openCount}
        title={sheet?.cred.label ?? "Passkey"}
        onClose={() => { if (sheet) setSheet(null); }}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Btn variant="ghost" onClick={() => setSheet(null)}>CLOSE</Btn>
            {deleting
              ? <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">Deleting...</span>
              : <ArmedButton label="DELETE" onConfirm={() => void remove()} />}
          </div>
        }
      >
        {sheet?.error && <SheetError>{sheet.error}</SheetError>}
        {sheet && (
          <>
            <dl className="flex flex-col gap-4">
              <Item label="Type">{transportLabel(sheet.cred.transports)}</Item>
              <Item label="Added">{fmtDate(sheet.cred.createdAt)}</Item>
              <Item label="Last used">{sheet.cred.lastUsedAt ? fmtDate(sheet.cred.lastUsedAt) : "Not yet"}</Item>
            </dl>
            <p className="mt-5 text-[12px] text-ak-text-dim">
              {credentials.length === 1
                ? "This is your last passkey. Deleting it means signing in with the password until you register another."
                : "Deleting it stops this device signing in with a passkey."}
            </p>
          </>
        )}
      </BottomSheet>
    </>
  );
}

PasskeysPage.getLayout = adminLayout("Passkeys");

function Panel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5">
      <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim mb-1">{label}</div>
      {hint && <div className="text-[11px] text-ak-text-dim mb-3 leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">{label}</dt>
      <dd className="mt-1 text-[15px] text-ak-text">{children}</dd>
    </div>
  );
}

function PasskeySkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1].map(i => (
        <li key={i} className="h-[58px] rounded-xl border border-ak-border bg-ak-base animate-pulse" />
      ))}
    </ul>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
