import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AdminLayout, Spinner, PasskeyLoginForm, useAdminAuth, byJersey } from "@/client/admin";
import type { Player } from "@/client/admin";
import { getAdminPasskeyLoginProps } from "@/server/auth";
import { initials } from "@/domain/players/format";
import { cloudinaryThumb } from "@/domain/shared/cloudinary";

const SAVED_MSG: Record<string, string> = {
  created: "Player added!",
  updated: "Player saved!",
  retired: "Player retired.",
};

export default function RosterPage({
  validSlug, showFallback, noPasskeys,
}: { validSlug: boolean; showFallback: boolean; noPasskeys: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: authLoading, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; type?: string } | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const saved = typeof router.query.saved === "string" ? router.query.saved : null;
    const msg = saved ? (Reflect.get(SAVED_MSG, saved) as string | undefined) : undefined;
    if (msg) {
      setToast({ msg, type: "success" });
      router.replace(`/admin/${slug}/roster`, undefined, { shallow: true });
    }
  }, [router, slug]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/players");
      if (res.ok) {
        const d = await res.json();
        setPlayers(d.players ?? []);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (authed && slug) loadPlayers();
  }, [authed, slug]);

  if (!validSlug) return null;
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base"><Spinner /></div>
  );
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
      <PasskeyLoginForm onPasskeyLogin={handlePasskeyLogin} onFallbackLogin={handleLogin} loginError={loginError} showFallback={showFallback} noPasskeys={noPasskeys} />
    </div>
  );

  const sorted = [...players].sort(byJersey);

  return (
    <AdminLayout slug={slug} title="Roster" toast={toast} setToast={setToast} onLogout={handleLogout}>
      <header className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-[22px] md:text-[28px] font-black text-ak-text">Roster</h1>
        <Link
          href={`/admin/${slug}/roster/new`}
          className="inline-flex items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
        >
          + Add player
        </Link>
      </header>

      {loading ? (
        <RosterSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState slug={String(slug)} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(p => (
            <li key={p.id}>
              <PlayerCard player={p} slug={String(slug)} />
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}

function PlayerCard({ player, slug }: { player: Player; slug: string }) {
  return (
    <Link
      href={`/admin/${slug}/roster/${player.id}`}
      className="block rounded-xl border border-ak-border bg-ak-surface p-4 hover:border-ak-border2 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Avatar name={player.name} photoUrl={player.photoUrl ?? null} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-black text-ak-red-text tracking-[0.06em]">
              #{player.number}
            </span>
            <span className="text-[14px] font-black text-ak-text truncate">
              {player.name}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-ak-text-dim truncate">
            {player.position}
            {player.height ? ` · ${player.height}` : ""}
            {player.weight ? ` · ${player.weight}` : ""}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return (
      <Image
        src={cloudinaryThumb(photoUrl, 80)}
        alt={name}
        width={40}
        height={40}
        onError={() => setBroken(true)}
        className="w-10 h-10 rounded-full object-cover shrink-0"
        style={{ objectPosition: "top center" }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#111111] text-white text-[12px] font-extrabold tracking-[0.04em] shrink-0"
    >
      {initials(name)}
    </span>
  );
}

function EmptyState({ slug }: { slug: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ak-border bg-ak-surface px-6 py-10 text-center">
      <div className="text-[15px] font-black text-ak-text mb-1">No players yet</div>
      <div className="text-[12px] text-ak-text-dim mb-4">
        Add the active roster so games can record stats.
      </div>
      <Link
        href={`/admin/${slug}/roster/new`}
        className="inline-flex items-center gap-1 py-[9px] px-[16px] text-[12px] font-black tracking-[0.12em] uppercase rounded-lg bg-ak-red text-ak-text"
      >
        + Add the first player
      </Link>
    </div>
  );
}

function RosterSkeleton() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <li key={i} className="rounded-xl border border-ak-border bg-ak-surface h-[80px] animate-pulse" />
      ))}
    </ul>
  );
}

export async function getServerSideProps({ params, query }: { params: { slug: string }; query: import("querystring").ParsedUrlQuery }) {
  return getAdminPasskeyLoginProps(params, query);
}
