import { useState } from "react";
import Layout from "../components/Layout";
import { SectionHeading, StatTile } from "../components/ui";
import { C, chartTooltipStyle } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import { computeRecord } from "../lib/stats";
import { fmt } from "../lib/utils";
import SeasonSelector from "../components/SeasonSelector";
import ErrorBoundary from "../components/ErrorBoundary";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "../components/Charts";

const LEAGUE_TABS = [
  { key: "all",       label: "All Games"     },
  { key: "rookie",    label: "Rookie League" },
  { key: "bc6",       label: "BC6"           },
  { key: "wintercup", label: "Winter Cup"    },
];

const LEAGUE_LABELS = { all: "All Games", rookie: "Rookie League", bc6: "BC6", wintercup: "Winter Cup" };

/**
 * Normalise a league slug for comparison so minor DB variations
 * (e.g. "Rookie", "rookie-league", "ROOKIE") still match the tab key.
 */
function normaliseSlug(slug) {
  if (!slug) return "";
  const s = slug.toLowerCase().replace(/[\s_-]+/g, "");
  if (s.includes("rookie") || s.includes("neon") || s.includes("νεαν") || s.includes("νεων")) return "rookie";
  if (s.includes("bc6") || s.includes("b6") || s.includes("βκατ")) return "bc6";
  if (s.includes("winter") || s.includes("χειμ")) return "wintercup";
  return slug.toLowerCase();
}

export default function TeamPage({ players, games, seasons, currentSeason }) {
  const [league, setLeague] = useState("all");

  const handleSeasonChange = sid => {
    window.location.href = sid === "all-time" ? "/team" : `/team?season=${sid}`;
  };

  // Pre-normalise all game league slugs once, so every downstream
  // consumer uses the same normalised value -- avoids the divergence
  // where computeRecord used raw slugs while the box score used normalised ones.
  const normalisedGames = games.map(g => ({ ...g, _normLeague: normaliseSlug(g.league) }));

  // Filter by the active tab using the pre-normalised slug.
  // "all" shows every game regardless of league.
  const filteredGames = league === "all"
    ? normalisedGames
    : normalisedGames.filter(g => g._normLeague === league);

  const gp = filteredGames.length;

  // filteredGames is already scoped to the active league tab -- pass no
  // leagueFilter so computeRecord doesn't re-filter and produce wrong PPG
  // for the "all" tab (where no game has g.league === "all").
  const rec = computeRecord(filteredGames);

  const allRows = filteredGames.flatMap(g => g.boxScore || []).filter(r => r.min > 0);
  const sum    = key => allRows.reduce((a, r) => a + (r[key] || 0), 0);
  const avg    = (key, n = gp) => n > 0 ? +(sum(key) / n).toFixed(1) : 0;
  const pct    = (m, a) => { const t = sum(a); return t > 0 ? +(sum(m) / t * 100).toFixed(1) : 0; };

  const teamAvg = {
    rpg:    avg("reb"), apg: avg("ast"),
    spg:    avg("stl"), bpg: avg("blk"), tpg: avg("tov"),
    fgPct:  pct("fgm","fga"), fg3Pct: pct("fg3m","fg3a"), ftPct: pct("ftm","fta"),
    atRatio: sum("tov") > 0 ? +(sum("ast") / sum("tov")).toFixed(2) : 0,
  };

  // Offensive / Defensive Rating -- game-level floats, averaged across filtered games
  const ratedGames  = filteredGames.filter(g => g.offRating != null);
  const offRtgAvg   = ratedGames.length > 0
    ? +(ratedGames.reduce((a, g) => a + g.offRating, 0) / ratedGames.length).toFixed(1)
    : null;
  const defRtgAvg   = ratedGames.length > 0
    ? +(ratedGames.reduce((a, g) => a + g.defRating, 0) / ratedGames.length).toFixed(1)
    : null;

  const playerPpg = players.map(p => {
    const rows = filteredGames
      .flatMap(g => (g.boxScore || []).filter(r => r.pid === p.id && r.min > 0));
    const n = rows.length;
    if (n === 0) return null;
    const ppg = +(rows.reduce((a, r) => a + (r.pts || 0), 0) / n).toFixed(1);
    return { id: p.id, name: p.name, ppg, gp: n };
  }).filter(Boolean).sort((a, b) => b.ppg - a.ppg).slice(0, 5);

  const playerEff = players.map(p => {
    const rows = filteredGames
      .flatMap(g => (g.boxScore || []).filter(r => r.pid === p.id && r.min > 0));
    const n = rows.length;
    if (n === 0) return null;
    const eff = +(rows.reduce((a, r) => a + (r.eff || 0), 0) / n).toFixed(1);
    return { id: p.id, name: p.name, eff, gp: n };
  }).filter(Boolean).sort((a, b) => b.eff - a.eff).slice(0, 5);

  // Minutes distribution -- horizontal bar chart, fmt() gives "Lastname F."
  const minutesDist = players
    .map(p => {
      const rows = filteredGames
        .flatMap(g => (g.boxScore || []).filter(r => r.pid === p.id && r.min > 0));
      const n = rows.length;
      if (n === 0) return null;
      return {
        name:     fmt(p.name),
        fullName: p.name,
        mpg:      +(rows.reduce((a, r) => a + (r.min || 0), 0) / n).toFixed(1),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.mpg - a.mpg);

  // Dynamic height: 36px per player row
  const chartHeight = Math.max(200, minutesDist.length * 36 + 20);

  const tabStyle = (key) => ({
    padding: "6px 16px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    borderRadius: 8,
    border: `1px solid ${league === key ? C.red : C.border}`,
    background: league === key ? C.red : "transparent",
    color: league === key ? C.text : C.textDim,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  });

  if (games.length === 0) {
    return (
      <Layout title="Team Stats">
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:4 }}>
          <img src="/logo.png" alt="Armani Katehano" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
          <SectionHeading label="2025-26 Season" title="Team Stats" />
        </div>
        <div style={{ textAlign:"center", padding:48, color:C.textDim }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No data yet</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Team Stats">
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:4 }}>
        <img src="/logo.png" alt="Armani Katehano" style={{ width:64, height:64, objectFit:"contain", flexShrink:0 }} />
        <SectionHeading label="2025-26 Season" title="Team Stats" right={`${gp} games played`} />
      </div>

      <SeasonSelector seasons={seasons} currentSeason={currentSeason} onChange={handleSeasonChange} showAllTime={false} />

      {/* League tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
        {LEAGUE_TABS.map(t => (
          <button key={t.key} style={tabStyle(t.key)} onClick={() => setLeague(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {gp === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:C.textDim, borderRadius:12, border:`1px solid ${C.border}`, background:C.surface }}>
          <div style={{ fontSize:13, fontWeight:700 }}>No {LEAGUE_LABELS[league]} games recorded yet</div>
        </div>
      ) : (
        <>
          {/* Key averages */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:24 }}>
            <StatTile label="PPG"     value={rec.ppg}             sub="per game" highlight />
            <StatTile label="OPP PPG" value={rec.oppPpg}          sub="per game" />
            <StatTile label="RPG"     value={teamAvg.rpg}         sub="per game" />
            <StatTile label="APG"     value={teamAvg.apg}         sub="per game" />
            <StatTile label="SPG"     value={teamAvg.spg}         sub="per game" />
            <StatTile label="BPG"     value={teamAvg.bpg}         sub="per game" />
            <StatTile label="TOV"     value={teamAvg.tpg}         sub="per game" />
            <StatTile label="A/T"     value={teamAvg.atRatio}     sub="ast / tov" />
            <StatTile label="OFF RTG" value={offRtgAvg ?? "--"}    sub="off rating" />
            <StatTile label="DEF RTG" value={defRtgAvg ?? "--"}    sub="def rating" />
            <StatTile label="FG%"     value={`${teamAvg.fgPct}%`}  sub="field goal" />
            <StatTile label="3P%"     value={`${teamAvg.fg3Pct}%`} sub="three-point" />
            <StatTile label="FT%"     value={`${teamAvg.ftPct}%`}  sub="free throw" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20, marginBottom:20 }}>
            {/* Record breakdown */}
            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Record Breakdown</div>
              {[
                ["Overall", rec.wins,     rec.losses],
                ["Home",    rec.homeWins, rec.homeLosses],
                ["Away",    rec.awayWins, rec.awayLosses],
              ].map(([label, w, l]) => (
                <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.textSub }}>{label}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16, fontWeight:900, color:C.text }}>{w}-{l}</span>
                    <span style={{ fontSize:11, color:C.textDim }}>{w+l > 0 ? `${(w/(w+l)*100).toFixed(0)}%` : "--"}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:16, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.textSub }}>Current Streak</span>
                  <span style={{
                    fontSize:14, fontWeight:900,
                    color: rec.streak.count === 0 ? C.textDim : rec.streak.type === "W" ? C.green : C.redText,
                  }}>
                    {rec.streak.count === 0 ? "--" : `${rec.streak.count}${rec.streak.type}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Shooting */}
            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Shooting Splits</div>
              {[
                ["Field Goals",  teamAvg.fgPct],
                ["3-Pointers",   teamAvg.fg3Pct],
                ["Free Throws",  teamAvg.ftPct],
              ].map(([label, val]) => (
                <div key={label} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.textSub }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:900, color:C.text }}>{val}%</span>
                  </div>
                  <div style={{ height:4, borderRadius:2, background:C.border }}>
                    <div style={{ height:"100%", borderRadius:2, background:C.redBright, width:`${Math.min(100,val)}%`, transition:"width 0.4s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Scorers + Efficiency Leaders */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20, marginBottom:20 }}>
            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Top Scorers -- PPG</div>
              {playerPpg.length === 0
                ? <div style={{ fontSize:12, color:C.textDim }}>No data</div>
                : playerPpg.map((p, i) => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:10, fontWeight:900, width:16, color:i===0?C.redText:C.textDim }}>{i+1}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{fmt(p.name)}</span>
                      <span style={{ fontSize:10, color:C.textDim }}>{p.gp}G</span>
                    </div>
                    <span style={{ fontSize:16, fontWeight:900, color:i===0?C.redText:C.text }}>{p.ppg}</span>
                  </div>
                ))
              }
            </div>

            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Efficiency Leaders</div>
              {playerEff.length === 0
                ? <div style={{ fontSize:12, color:C.textDim }}>No data</div>
                : playerEff.map((p, i) => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:10, fontWeight:900, width:16, color:i===0?C.redText:C.textDim }}>{i+1}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{fmt(p.name)}</span>
                      <span style={{ fontSize:10, color:C.textDim }}>{p.gp}G</span>
                    </div>
                    <span style={{ fontSize:16, fontWeight:900, color:i===0?C.redText:C.text }}>{p.eff}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Minutes distribution -- horizontal bar chart, mobile-friendly */}
          {minutesDist.length > 0 && (
            <div style={{ borderRadius:12, padding:20, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:16, textTransform:"uppercase" }}>Minutes Distribution (MPG)</div>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={minutesDist}
                  layout="vertical"
                  margin={{ top:0, right:40, left:0, bottom:0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill:C.textDim, fontSize:11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 40]}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill:C.textSub, fontSize:12, fontWeight:700 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={v => [`${v} min`]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                  />
                  <Bar dataKey="mpg" fill={C.red} radius={[0,4,4,0]} maxBarSize={22} label={{ position:"right", fill:C.textDim, fontSize:11, fontWeight:700 }}>
                    {minutesDist.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? C.redBright : C.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  const { seasons, currentSeason, players, games } = await getAllPublicData(null);
  return { props: { players, games, seasons, currentSeason }, revalidate: 3600 };
}