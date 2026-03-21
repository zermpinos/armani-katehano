/**
 * pages/admin/[slug]/import.js
 *
 * Receives pre-scraped JSON (posted by your local scrape.js script OR
 * pasted manually), shows a full review UI, and saves to DB on confirm.
 *
 * The local script hits POST /api/admin/import with { secret, data }.
 * When that succeeds the game is saved immediately -- no browser needed.
 *
 * The browser UI here is for:
 *   a) Reviewing what was imported (the page shows the last import)
 *   b) Manual JSON paste fallback if you ever need it
 *   c) Editing the box score before saving (just in case)
 */

import { useState, useEffect, useRef } from "react";
import { C } from "../../../lib/theme";
import {
  AdminLayout, useAdminAuth, BoxScoreTable,
  F, Sel, Btn, byJersey,
} from "../../../lib/adminShared";

export default function ImportPage({ validSlug }) {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";
  const { authed, checking } = useAdminAuth(validSlug);

  const [players,       setPlayers]       = useState([]);
  const [seasonLeagues, setSeasonLeagues] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);

  // Import flow state
  const [jsonText,  setJsonText]  = useState("");
  const [phase,     setPhase]     = useState("idle"); // idle | review | saving
  const [draft,     setDraft]     = useState(null);
  const [highlights, setHighlights] = useState({});
  const [warnings,  setWarnings]  = useState([]);
  const [error,     setError]     = useState("");

  const showToast = (msg, type = "success") => setToast({ msg, type });

  useEffect(() => {
    if (authed) loadBase();
  }, [authed]);

  const loadBase = async () => {
    setLoading(true);
    try {
      // Only fetch players + season leagues -- that's all import needs
      const [pRes, slRes] = await Promise.all([
        fetch("/api/admin/players"),
        fetch("/api/admin/season-leagues"),
      ]);
      const [p, sl] = await Promise.all([pRes.json(), slRes.json()]);
      setPlayers(p.players ?? []);
      setSeasonLeagues(sl.seasonLeagues ?? []);
    } finally {
      setLoading(false);
    }
  };

  // ── buildDraft -- same logic as original _slug_.js, unchanged ─────────────
  const buildDraft = (data) => {
    const mi = data.match_info;
    const ak = data.armani_katehano;
    const matchedSL = seasonLeagues.find(sl => sl.leagueSlug === mi.league) ?? seasonLeagues[0];

    const boxScore = [...players].sort(byJersey).map(p => {
      const parsed = ak.players.find(pp => pp.jersey_number === Number(p.number));
      if (!parsed || parsed.did_not_play) {
        return { pid: p.id, min: 0, pts: 0, reb: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, eff: 0 };
      }
      return {
        pid:  p.id,
        min:  parsed.minutes_played?.total_seconds ? Math.round(parsed.minutes_played.total_seconds / 60) : 0,
        pts:  parsed.points,
        reb:  parsed.total_rebounds,
        orb:  parsed.offensive_rebounds ?? 0,
        drb:  parsed.defensive_rebounds ?? 0,
        ast:  parsed.assists,
        stl:  parsed.steals,
        blk:  parsed.blocks,
        tov:  parsed.turnovers,
        pf:   parsed.fouls_committed ?? 0,
        fgm:  (parsed.two_point_fg?.made ?? 0) + (parsed.three_point_fg?.made ?? 0),
        fga:  (parsed.two_point_fg?.attempted ?? 0) + (parsed.three_point_fg?.attempted ?? 0),
        fg2m: parsed.two_point_fg?.made ?? 0,
        fg2a: parsed.two_point_fg?.attempted ?? 0,
        fg3m: parsed.three_point_fg?.made ?? 0,
        fg3a: parsed.three_point_fg?.attempted ?? 0,
        ftm:  parsed.free_throws?.made ?? 0,
        fta:  parsed.free_throws?.attempted ?? 0,
        eff:  parsed.efficiency ?? 0,
      };
    });

    const hl = {};
    ak.players.filter(p => !p.did_not_play).forEach(p => {
      const player = players.find(pl => Number(pl.number) === p.jersey_number);
      if (player) hl[player.id] = true;
    });

    return {
      draft: {
        date:           mi.date || "",
        opponent:       mi.opponent || "",
        home:           mi.home_team?.toUpperCase().includes("ARMANI") || mi.home_team?.toUpperCase().includes("KATEHANO"),
        result:         mi.result || "W",
        teamScore:      mi.armani_katehano_score ?? "",
        opponentScore:  mi.opponent_score ?? "",
        seasonLeagueId: matchedSL?.id ?? "",
        boxScore,
      },
      highlights: hl,
    };
  };

  // ── Parse the JSON and move to review phase ───────────────────────────────
  const parseAndReview = () => {
    setError("");
    try {
      const data = JSON.parse(jsonText.trim());
      if (!data.match_info || !data.armani_katehano?.players)
        throw new Error("Missing match_info or armani_katehano.players");
      const { draft, highlights } = buildDraft(data);
      setDraft(draft);
      setHighlights(highlights);
      setWarnings(data._warnings ?? []);
      setPhase("review");
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
    }
  };

  const updDraft = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const updBox   = (pid, k, v) => setDraft(d => ({
    ...d, boxScore: d.boxScore.map(r => r.pid === pid ? { ...r, [k]: parseFloat(v) || 0 } : r)
  }));

  // ── Save to DB ────────────────────────────────────────────────────────────
  const save = async () => {
    setPhase("saving");
    const boxScore = draft.boxScore.map(r => {
      const fg2m = r.fg2m || 0, fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0, fg3a = r.fg3a || 0;
      return {
        playerId: r.pid,
        minutes:  r.min || 0,
        pts: r.pts || 0, reb: r.reb || 0, orb: r.orb || 0, drb: r.drb || 0,
        ast: r.ast || 0, stl: r.stl || 0, blk: r.blk || 0, tov: r.tov || 0,
        pf: r.pf || 0, fgm: fg2m + fg3m, fga: fg2a + fg3a, fg3m, fg3a,
        ftm: r.ftm || 0, fta: r.fta || 0,
      };
    });

    const res = await fetch("/api/admin/games", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seasonLeagueId: draft.seasonLeagueId,
        opponent:       draft.opponent,
        location:       draft.home ? "home" : "away",
        teamScore:      Number(draft.teamScore) || 0,
        opponentScore:  Number(draft.opponentScore) || 0,
        result:         draft.result,
        playedOn:       draft.date,
        boxScore,
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      showToast(d.error || "Save failed", "error");
      setPhase("review");
      return;
    }

    showToast("Game saved!");
    setPhase("idle");
    setDraft(null);
    setJsonText("");
    setHighlights({});
    setWarnings([]);
  };

  const leagueOptions = seasonLeagues.map(sl => ({ value: sl.id, label: sl.leagueName }));

  if (!validSlug) return null;
  if (checking || loading) return <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>;
  if (!authed) { if (typeof window !== "undefined") window.location.href = `/admin/${slug}`; return null; }

  return (
    <AdminLayout slug={slug} title="Import" toast={toast} setToast={setToast}>
      <div style={{ maxWidth: 900 }}>

        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 4 }}>Import game</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
            Run <code style={{ background: C.surface2, padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>node scripts/scrape.js [url]</code> locally.
            The script will POST the JSON here automatically, or paste it below.
          </div>
        </div>

        {/* ── IDLE: JSON paste ── */}
        {phase === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase" }}>
              Paste scraped JSON
            </div>
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder='{"match_info": {...}, "armani_katehano": {...}}'
              style={{ width: "100%", minHeight: 180, fontSize: 11, fontFamily: "monospace", padding: 12, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, resize: "vertical" }}
            />
            {error && (
              <div style={{ fontSize: 12, color: C.redText, padding: "8px 12px", borderRadius: 8, background: `${C.red}18`, border: `1px solid ${C.red}40` }}>
                {error}
              </div>
            )}
            <div>
              <Btn onClick={parseAndReview} disabled={!jsonText.trim()}>REVIEW</Btn>
            </div>
          </div>
        )}

        {/* ── REVIEW: edit & confirm ── */}
        {(phase === "review" || phase === "saving") && draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: `${C.red}18`, border: `1px solid ${C.red}40`, fontSize: 12, color: C.redText }}>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>⚠ Sanity check warnings -- review before saving:</div>
                {warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}

            {/* Game metadata */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>Game info</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
                <F label="DATE"       value={draft.date}          onChange={v => updDraft("date", v)}          placeholder="YYYY-MM-DD" />
                <F label="OPPONENT"   value={draft.opponent}      onChange={v => updDraft("opponent", v)} />
                <Sel label="LEAGUE"   value={draft.seasonLeagueId || ""} onChange={v => updDraft("seasonLeagueId", v)} options={leagueOptions} />
                <Sel label="HOME/AWAY" value={draft.home ? "home" : "away"} onChange={v => updDraft("home", v === "home")} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
                <Sel label="RESULT"   value={draft.result}        onChange={v => updDraft("result", v)}        options={[{ value: "W", label: "Win" }, { value: "L", label: "Loss" }]} />
                <F label="OUR SCORE"  value={draft.teamScore}     onChange={v => updDraft("teamScore", v)}     type="number" />
                <F label="OPP SCORE"  value={draft.opponentScore} onChange={v => updDraft("opponentScore", v)} type="number" />
              </div>
            </div>

            {/* Box score */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>
                Box score -- green rows played
              </div>
              <BoxScoreTable players={players} rows={draft.boxScore} onUpdate={updBox} highlights={highlights} />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <Btn onClick={save} variant="green" disabled={phase === "saving"}>
                {phase === "saving" ? "SAVING..." : "SAVE GAME"}
              </Btn>
              <Btn variant="ghost" onClick={() => { setPhase("idle"); setDraft(null); }} disabled={phase === "saving"}>
                BACK
              </Btn>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.border2}`, borderTopColor: C.redBright, animation: "spin 0.7s linear infinite" }} />
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { slug } = params;
  const expected = process.env.ADMIN_SLUG;
  let validSlug = false;
  try {
    const crypto = await import("crypto");
    const a = Buffer.from(slug || "");
    const b = Buffer.from(expected || "");
    if (a.length === b.length) validSlug = crypto.timingSafeEqual(a, b);
  } catch { validSlug = slug === expected; }
  return { props: { validSlug } };
}

