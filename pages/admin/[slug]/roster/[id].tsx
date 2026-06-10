import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, PasskeyLoginForm, F, Sel, Btn, Confirm, useAdminAuth, apiFetch } from "@/client/admin";
import type { Player } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { POSITIONS } from "@/domain/players/positions";
import { initials } from "@/domain/players/format";
import { cloudinaryThumb } from "@/domain/shared/cloudinary";

type Draft = {
  name:     string;
  number:   string;
  position: string;
  height:   string;
  weight:   string;
  photoUrl: string;
  isActive: boolean;
};

const EMPTY: Draft = {
  name: "", number: "", position: "PG",
  height: "", weight: "", photoUrl: "", isActive: true,
};

function playerToDraft(p: Player): Draft {
  return {
    name:     p.name,
    number:   String(p.number),
    position: p.position,
    height:   p.height ?? "",
    weight:   p.weight ?? "",
    photoUrl: p.photoUrl ?? "",
    isActive: p.isActive ?? true,
  };
}

export default function RosterEditPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;
  const idParam = typeof router.query.id === "string" ? router.query.id : null;
  const isNew = idParam === "new";

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [draft,    setDraft]    = useState<Draft>(EMPTY);
  const [loading,  setLoading]  = useState(!isNew);
  const [saving,   setSaving]   = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [askRetire, setAskRetire] = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type?: string } | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (!authed || !slug || isNew || !idParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/players");
        if (!res.ok) { if (!cancelled) { setNotFound(true); setLoading(false); } return; }
        const data = await res.json();
        const p = (data.players as Player[] | undefined)?.find(x => x.id === idParam);
        if (cancelled) return;
        if (!p) { setNotFound(true); setLoading(false); return; }
        setDraft(playerToDraft(p));
        setLoading(false);
      } catch {
        if (!cancelled) { setNotFound(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady, authed, slug, idParam, isNew]);

  const upd = (k: keyof Draft, v: string | boolean) => setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.name.trim()) {
      setToast({ msg: "Name is required", type: "error" });
      return;
    }
    if (draft.number === "") {
      setToast({ msg: "Jersey number is required", type: "error" });
      return;
    }
    const numberNum = Number(draft.number);
    if (!Number.isFinite(numberNum) || numberNum < 0) {
      setToast({ msg: "Jersey number must be a non-negative integer", type: "error" });
      return;
    }
    setSaving(true);
    const payload = {
      name:     draft.name.trim(),
      number:   numberNum,
      position: draft.position,
      height:   draft.height.trim() || null,
      weight:   draft.weight.trim() || null,
      photoUrl: draft.photoUrl.trim() || null,
      isActive: draft.isActive,
    };
    const res = await apiFetch("/api/admin/players", {
      method:  isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(isNew ? payload : { playerId: idParam, ...payload }),
    });
    if (!res.ok) {
      const body = await res.json();
      setToast({ msg: body.error ?? "Save failed", type: "error" });
      setSaving(false);
      return;
    }
    router.push(`/admin/${slug}/roster?saved=${isNew ? "created" : "updated"}`);
  };

  const retire = async () => {
    if (isNew || !idParam) return;
    setSaving(true);
    const res = await apiFetch("/api/admin/players", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        playerId: idParam,
        name:     draft.name.trim(),
        number:   Number(draft.number),
        position: draft.position,
        height:   draft.height.trim() || null,
        weight:   draft.weight.trim() || null,
        photoUrl: draft.photoUrl.trim() || null,
        isActive: false,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setToast({ msg: body.error ?? "Retire failed", type: "error" });
      setSaving(false);
      setAskRetire(false);
      return;
    }
    router.push(`/admin/${slug}/roster?saved=retired`);
  };

  if (!validSlug) return null;
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
    </div>
  );

  const title = isNew ? "Add player" : "Edit player";

  return (
    <AdminLayout slug={slug} title={title} toast={toast} setToast={setToast} onLogout={handleLogout}>
      <Link
        href={`/admin/${slug}/roster`}
        className="inline-flex items-center gap-1 text-[11px] font-black tracking-[0.12em] uppercase text-ak-text-dim mb-3"
      >
        ← Roster
      </Link>
      <h1 className="text-[22px] md:text-[28px] font-black text-ak-text mb-6">{title}</h1>

      {loading ? (
        <div className="flex justify-center py-[60px]"><Spinner /></div>
      ) : notFound ? (
        <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
          <div className="text-[15px] font-black text-ak-text mb-1">Player not found</div>
          <div className="text-[12px] text-ak-text-dim mb-4">It may have been retired or removed.</div>
          <Link href={`/admin/${slug}/roster`} className="text-[11px] font-black tracking-[0.12em] uppercase text-ak-red-text">
            ← Back to roster
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-ak-border bg-ak-surface p-4 md:p-5 mb-5">
            <div className="flex items-center gap-4 mb-5">
              <AvatarPreview name={draft.name || "?"} photoUrl={draft.photoUrl} />
              <div className="min-w-0">
                <div className="text-[10px] font-black tracking-[0.15em] uppercase text-ak-text-dim">Preview</div>
                <div className="text-[12px] text-ak-text-dim mt-1 leading-relaxed">
                  Cloudinary URLs are auto-thumbnailed. Other URLs are loaded as-is.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <F label="FULL NAME" value={draft.name} onChange={v => upd("name", v)} />
              <F label="JERSEY #" value={draft.number} onChange={v => upd("number", v)} type="number" />
              <Sel
                label="POSITION"
                value={draft.position}
                onChange={v => upd("position", v)}
                options={POSITIONS.map(p => ({ value: p, label: p }))}
              />
              <F label="HEIGHT" value={draft.height} onChange={v => upd("height", v)} placeholder='e.g. 6&apos;4"' />
              <F label="WEIGHT" value={draft.weight} onChange={v => upd("weight", v)} placeholder="e.g. 90 kg" />
            </div>
            <F label="PHOTO URL" value={draft.photoUrl} onChange={v => upd("photoUrl", v)} placeholder="https://res.cloudinary.com/..." />
          </div>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-ak-base border-t border-ak-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Btn onClick={save} disabled={saving}>{saving ? "SAVING..." : isNew ? "ADD PLAYER" : "SAVE CHANGES"}</Btn>
              <Link
                href={`/admin/${slug}/roster`}
                className="py-[9px] px-[18px] text-[13px] font-black tracking-[0.12em] rounded-lg border border-ak-border2 text-ak-text-sub"
              >
                CANCEL
              </Link>
            </div>
            {!isNew && (
              <Btn variant="danger" onClick={() => setAskRetire(true)} disabled={saving}>
                RETIRE
              </Btn>
            )}
          </div>
        </>
      )}

      {askRetire && (
        <Confirm
          msg={`Retire ${draft.name}? Their historical game stats stay intact; they will no longer appear on the active roster.`}
          onConfirm={retire}
          onCancel={() => setAskRetire(false)}
        />
      )}
    </AdminLayout>
  );
}

function AvatarPreview({ name, photoUrl }: { name: string; photoUrl: string }) {
  // Track which URL is broken; changing photoUrl naturally clears the broken state.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const showImg = !!photoUrl && brokenUrl !== photoUrl;
  if (showImg) {
    return (
      <Image
        src={cloudinaryThumb(photoUrl, 160)}
        alt=""
        width={64}
        height={64}
        onError={() => setBrokenUrl(photoUrl)}
        className="w-16 h-16 rounded-full object-cover border border-ak-border2"
        style={{ objectPosition: "top center" }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#111111] text-white text-[16px] font-extrabold tracking-[0.04em] border border-ak-border2"
    >
      {initials(name)}
    </span>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
