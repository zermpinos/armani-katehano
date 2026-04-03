/**
 * pages/admin/[slug]/import.js
 * Admin enters a game URL → server scrapes it → admin reviews → saves.
 * Also accepts an optional YouTube video URL.
 */

import { useState, useEffect } from "react";
import { C } from "../../../lib/theme";
import { AdminLayout, BoxScoreTable, F, Sel, Btn, byJersey, useAdminAuth } from "../../../lib/adminShared";
import { validateAdminSlug } from '../../../lib/adminSlugCheck.js';
import { parseGreekDate, parseMinutes, detectLeagueSlug } from "../../../lib/greekDate.js";


export default function ImportPage({ validSlug }) {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";

  const { authed, loading: checking, loginError, handleLogin } = useAdminAuth(slug);

  const [players,       setPlayers]       = useState([]);
  const [seasonLeagues, setSeasonLeagues] = useState([]);
  const [dataLoading,   setDataLoading]   = useState(false);
  const [toast,         setToast]         = useState(null);

  const [gameUrl,    setGameUrl]    = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fetching,   setFetching]   = useState(false);
  const [phase,      setPhase]      = useState("idle");
  const [draft,      setDraft]      = useState(null);
  const [highlights, setHighlights] = useState({});
  const [warnings,   setWarnings]   = useState([]);
  const [error,      setError]      = useState("");

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const loadBase = async () => {
    setDataLoading(true);
    try {
      const [pRes, slRes] = await Promise.all([
        fetch("/api/admin/players"),
        fetch("/api/admin/season-leagues"),
      ]);
      if (pRes.ok)  { const d = await pRes.json();  setPlayers(d.players ?? []); }
      if (slRes.ok) { const d = await slRes.json(); setSeasonLeagues(d.seasonLeagues ?? []); }
    } finally { setDataLoading(false); }
  };

  useEffect(() => { if (authed) loadBase(); }, [authed]);

  // ── buildDraft — maps scraper JSON to the review UI ──────────────────────
  const buildDraft = (data) => {
    const { game, teams, url: sourceUrl } = data;

    const akTeam = teams.find(t =>
      t.name.toUpperCase().includes("ARMANI") ||
      t.name.toUpperCase().includes("KATEHANO")
    );
    if (!akTeam) throw new Error("ARMANI KATEHANO team not found in scraped data");

    const isHome      = game.homeTeam.toUpperCase().includes("ARMANI") ||
                        game.homeTeam.toUpperCase().includes("KATEHANO");
    const akScore     = isHome ? game.finalScore.home  : game.finalScore.away;
    const oppScore    = isHome ? game.finalScore.away  : game.finalScore.home;
    const oppTeamName = isHome ? game.awayTeam         : game.homeTeam;
    const result      = akScore > oppScore ? "W" : "L";
    const parsedDate  = parseGreekDate(game.date);
    const date        = parsedDate ? parsedDate.toISOString().slice(0, 10) : "";
    const leagueSlug  = detectLeagueSlug(sourceUrl);

    const matchedSL = seasonLeagues.find(sl => sl.leagueSlug === leagueSlug)
                   ?? seasonLeagues[0];

    const boxScore = [...players].sort(byJersey).map(dbPlayer => {
      const scraped = akTeam.players.find(p => p["#"] === Number(dbPlayer.number));
      const mins    = scraped ? parseMinutes(scraped.MIN) : 0;

      if (!scraped || mins === 0) {
        return {
          playerId: dbPlayer.id, minutes: 0, pts: 0, reb: 0, orb: 0, drb: 0,
          ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
          fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0,
          ftm: 0, fta: 0, eff: 0,
        };
      }

      const fg2m = scraped["2PTS"]?.made      ?? 0;
      const fg2a = scraped["2PTS"]?.attempted ?? 0;
      const fg3m = scraped["3PTS"]?.made      ?? 0;
      const fg3a = scraped["3PTS"]?.attempted ?? 0;

      return {
        playerId: dbPlayer.id,
        minutes:  mins,
        pts:  scraped.PTS  ?? 0,
        reb:  scraped.REB  ?? 0,
        orb:  scraped.OREB ?? 0,
        drb:  scraped.DREB ?? 0,
        ast:  scraped.AST  ?? 0,
        stl:  scraped.STL  ?? 0,
        blk:  scraped.BLK  ?? 0,
        tov:  scraped.TO   ?? 0,
        pf:   scraped.PF   ?? 0,
        fg2m, fg2a, fg3m, fg3a,
        fgm:  fg2m + fg3m,
        fga:  fg2a + fg3a,
        ftm:  scraped.FT?.made      ?? 0,
        fta:  scraped.FT?.attempted ?? 0,
        eff:  scraped.EF  ?? 0,
      };
    });

    const hl = {};
    akTeam.players.forEach(p => {
      if (parseMinutes(p.MIN) > 0) {
        const dbPlayer = players.find(pl => Number(pl.number) === p["#"]);
        if (dbPlayer) hl[dbPlayer.id] = true;  // keyed by playerId
      }
    });

    const warns = [];
    akTeam.players.filter(p => parseMinutes(p.MIN) > 0).forEach(p => {
      const fg2m = p["2PTS"]?.made ?? 0;
      const fg3m = p["3PTS"]?.made ?? 0;
      const ftm  = p.FT?.made ?? 0;
      const expPts = fg2m * 2 + fg3m * 3 + ftm;
      if ((p.PTS ?? 0) !== expPts)
        warns.push(`#${p["#"]} ${p.Players}: pts=${p.PTS}, expected ${expPts}`);
    });

    return {
      draft: {
        date,
        opponent:       oppTeamName,
        home:           isHome,
        result,
        teamScore:      akScore,
        opponentScore:  oppScore,
        seasonLeagueId: matchedSL?.id ?? "",
        sourceUrl:      sourceUrl ?? null,
        boxScore,
      },
      highlights: hl,
      warnings:   warns,
    };
  };

  // ── fetchAndReview — calls the server-side scraper ───────────────────────
  const fetchAndReview = async () => {
    setError("");
    setFetching(true);
    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gameUrl.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || "Scrape failed"); return; }

      const { draft, highlights, warnings } = buildDraft(body.data);
      setDraft(draft); setHighlights(highlights); setWarnings(warnings);
      setPhase("review");
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const updDraft = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const updBox   = (playerId, k, v) => setDraft(d => ({
    ...d, boxScore: d.boxScore.map(r => r.playerId === playerId ? { ...r, [k]: parseFloat(v) || 0 } : r)
  }));

  const save = async () => {
    setPhase("saving");
    const boxScore = draft.boxScore.map(r => {
      const fg2m = r.fg2m || 0, fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0, fg3a = r.fg3a || 0;
      return {
        playerId: r.playerId, minutes: r.minutes || 0,
        pts: r.pts || 0, reb: r.reb || 0, orb: r.orb || 0, drb: r.drb || 0,
        ast: r.ast || 0, stl: r.stl || 0, blk: r.blk || 0, tov: r.tov || 0,
        pf: r.pf || 0, fg2m, fg2a, fg3m, fg3a, fgm: fg2m + fg3m, fga: fg2a + fg3a,
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
        sourceUrl:      draft.sourceUrl ?? null,
        youtubeUrl:     youtubeUrl.trim() || null,
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
    setGameUrl("");
    setYoutubeUrl("");
    setHighlights({});
    setWarnings([]);
  };

  const leagueOptions = seasonLeagues.map(sl => ({ value: sl.id, label: sl.leagueName }));

  if (checking) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <LoginForm onLogin={handleLogin} error={loginError} />
    </div>
  );

  return (
    <AdminLayout slug={slug} title="Import" toast={toast} setToast={setToast}>
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 4 }}>Import game</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
            Paste the game URL from basketcity.sportstats.gr — the server fetches and parses it automatically.
          </div>
        </div>

        {dataLoading && <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>}

        {!dataLoading && phase === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 6, textTransform: "uppercase" }}>Game URL</div>
              <input
                type="url"
                value={gameUrl}
                onChange={e => setGameUrl(e.target.value)}
                placeholder="https://basketcity.sportstats.gr/men/gamedetails/id/…"
                disabled={fetching}
                style={{ width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 6, textTransform: "uppercase" }}>YouTube video URL <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>(optional)</span></div>
              <input
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                disabled={fetching}
                style={{ width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: C.redText, padding: "8px 12px", borderRadius: 8, background: `${C.red}18`, border: `1px solid ${C.red}40` }}>{error}</div>
            )}

            <div>
              <Btn onClick={fetchAndReview} disabled={!gameUrl.trim() || fetching}>
                {fetching ? "FETCHING…" : "FETCH & REVIEW"}
              </Btn>
            </div>

            {fetching && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.textDim, fontSize: 12 }}>
                <Spinner size={18} /> Scraping game page…
              </div>
            )}
          </div>
        )}

        {!dataLoading && (phase === "review" || phase === "saving") && draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {warnings.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: `${C.red}18`, border: `1px solid ${C.red}40`, fontSize: 12, color: C.redText }}>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>⚠ Warnings — review before saving:</div>
                {warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}

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

            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 6, textTransform: "uppercase" }}>YouTube video URL <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11 }}>(optional)</span></div>
              <input
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                style={{ width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: C.textDim, marginBottom: 10, textTransform: "uppercase" }}>Box score — green rows played</div>
              <BoxScoreTable players={players} rows={draft.boxScore} onUpdate={updBox} highlights={highlights} />
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <Btn onClick={save} variant="green" disabled={phase === "saving"}>{phase === "saving" ? "SAVING…" : "SAVE GAME"}</Btn>
              <Btn variant="ghost" onClick={() => { setPhase("idle"); setDraft(null); }} disabled={phase === "saving"}>BACK</Btn>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Spinner({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${C.border2}`, borderTopColor: C.redBright, animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
  );
}

function LoginForm({ onLogin, error }) {
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(password);
    setLoading(false);
  };

  return (
    <div style={{ width: "100%", maxWidth: 360, borderRadius: 20, padding: 32, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22, background: `${C.red}18`, border: `1px solid ${C.red}45` }}>🔐</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>Admin Access</div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Armani Katehano · Team Manager</div>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", marginBottom: 5, color: C.textDim, textTransform: "uppercase" }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
            style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${C.border2}`, background: C.base, color: C.text, fontFamily: "inherit", outline: "none" }} />
        </div>
        {error && <div style={{ fontSize: 12, color: C.redText }}>{error}</div>}
        <button type="submit" disabled={loading || !password}
          style={{ padding: "12px", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none", background: C.red, color: C.text, cursor: "pointer", fontFamily: "inherit", opacity: loading || !password ? 0.5 : 1 }}>
          {loading ? "VERIFYING…" : "SIGN IN"}
        </button>
      </form>
      <div style={{ textAlign: "center", fontSize: 10, color: C.textDim, marginTop: 16 }}>5 failed attempts → 15-minute lockout</div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  if (!await validateAdminSlug(params.slug)) return { notFound: true };
  return { props: { validSlug: true } };
}
