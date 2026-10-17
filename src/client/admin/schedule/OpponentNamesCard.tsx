import { useState } from "react";
import { F, Btn } from "@/client/admin/primitives";
import { apiFetch } from "@/client/admin/csrf";
import { useAdminData, mutateAdminData } from "@/client/admin/use-admin-data";
import { similarNames, type WaitingName } from "@/domain/import/opponent-names";

const URL_ = "/api/admin/opponent-names";
type Data = { waiting: WaitingName[]; names: string[] };

export function savedMessage(
  saved: { published: unknown[]; syncError: string | null },
  waitingOn: WaitingName["waitingOn"],
): { msg: string; type: "success" | "error" } {
  const n = saved.published.length;
  if (n) return { msg: `Saved. ${n} fixture${n === 1 ? "" : "s"} published.`, type: "success" };
  if (saved.syncError) return { msg: `Saved. The fixture could not be published now (${saved.syncError}). The nightly run will publish it.`, type: "error" };
  if (waitingOn === "result") return { msg: "Saved. The result imports on the nightly run, or from Import now.", type: "success" };
  return { msg: "Saved. Nothing new to publish.", type: "success" };
}

export function OpponentNamesCard({ onSaved, notify }: {
  onSaved: () => void;
  notify:  (msg: string, type: "success" | "error") => void;
}) {
  const { data } = useAdminData<Data>(URL_);
  if (!data || data.waiting.length === 0) return null;

  return (
    <section aria-labelledby="names-waiting" className="mb-4 rounded-xl border border-[#c9a84c55] bg-[#c9a84c12] p-4">
      <h2 id="names-waiting" className="text-[13px] font-black uppercase tracking-[0.12em] text-ak-gold">
        {`Opponent names waiting (${data.waiting.length})`}
      </h2>
      <p className="mt-1 text-[12px] text-ak-text-dim">
        The league spells these teams in a way the site has no name for, so their games stay off the site until you name them.
      </p>
      <datalist id="opponent-names">
        {data.names.map(n => <option key={n} value={n} />)}
      </datalist>
      <ul className="mt-3 flex flex-col gap-5">
        {data.waiting.map(w => (
          <WaitingRow key={w.scrapedName} waiting={w} names={data.names} onSaved={onSaved} notify={notify} />
        ))}
      </ul>
    </section>
  );
}

function WaitingRow({ waiting, names, onSaved, notify }: {
  waiting: WaitingName;
  names:   string[];
  onSaved: () => void;
  notify:  (msg: string, type: "success" | "error") => void;
}) {
  const [name,  setName]  = useState(waiting.suggestion);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);
  const similar = similarNames(waiting.scrapedName, names);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res  = await apiFetch(URL_, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scrapedName: waiting.scrapedName, displayName: name }),
      });
      const body = await res.json().catch(() => ({}));
      // A 401 leaves the row as it was behind the sign-in overlay.
      if (res.status === 401) return;
      if (res.status === 409) {
        mutateAdminData<Data>(URL_, d => ({ ...d, waiting: d.waiting.filter(x => x.scrapedName !== waiting.scrapedName) }));
        notify(typeof body.error === "string" ? body.error : "That name is already held.", "error");
        return;
      }
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not save the name.");
        return;
      }
      mutateAdminData<Data>(URL_, d => ({
        waiting: d.waiting.filter(x => x.scrapedName !== waiting.scrapedName),
        names:   [...new Set([...d.names, name.trim()])].sort(),
      }));
      const { msg, type } = savedMessage(body, waiting.waitingOn);
      notify(msg, type);
      onSaved();
    } catch {
      setError("Network error. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li>
      <div className="text-[15px] font-black text-ak-text">{waiting.scrapedName}</div>
      <div className="mb-2 text-[12px] text-ak-text-dim">
        {waiting.waitingOn === "fixture" ? `Fixture: ${waiting.dateText ?? ""}` : "A played game waits on this name."}
      </div>
      <F label={`NAME FOR ${waiting.scrapedName}`} value={name} onChange={setName} list="opponent-names" maxLength={100} />
      {similar.length > 0 && (
        <div role="group" aria-label="Similar names" className="mt-2 flex flex-wrap gap-2">
          {similar.map(n => (
            <button
              key={n}
              type="button"
              aria-pressed={name === n}
              onClick={() => setName(n)}
              className={[
                "min-h-[44px] cursor-pointer rounded-full border px-3 text-[12px] font-bold",
                name === n ? "border-ak-red-bright bg-ak-surface text-ak-text" : "border-ak-border2 bg-ak-base text-ak-text-sub",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {error && <div role="alert" className="mt-2 text-[13px] font-bold text-ak-red-text">{error}</div>}
      <div className="mt-3">
        <Btn onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? "SAVING..." : "SAVE"}</Btn>
      </div>
    </li>
  );
}
