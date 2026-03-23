import { useState } from "react";
import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import ErrorBoundary from "../components/ErrorBoundary";
import { fmt } from "../lib/utils";

const BOX_COLS = [
  {key:"min",label:"MIN"},{key:"pts",label:"PTS"},{key:"reb",label:"REB"},
  {key:"ast",label:"AST"},{key:"stl",label:"STL"},{key:"blk",label:"BLK"},{key:"tov",label:"TOV"},
  {key:"fgm",label:"FGM"},{key:"fga",label:"FGA"},{key:"fg3m",label:"3PM"},{key:"fg3a",label:"3PA"},
  {key:"ftm",label:"FTM"},{key:"fta",label:"FTA"},{key:"eff",label:"EFF"},
];

/**
 * B-04: topScorer was referenced in JSX but never set by getGames() in
 * repository.prisma.js, so it was silently undefined and never rendered.
 *
 * Fix: derive it client-side from the box score rows that are already present.
 * Returns a display string like "A. Katehano 22 PTS" or null if no box score.
 */
function getTopScorer(game, players) {
  const rows = game.boxScore;
  if (!rows || rows.length === 0) return null;

  const playing = rows.filter(r => (r.min || r.minutes || 0) > 0);
  if (playing.length === 0) return null;

  const best = playing.reduce((top, r) => (r.pts ?? 0) > (top.pts ?? 0) ? r : top, playing[0]);
  if (!best || (best.pts ?? 0) === 0) return null;

  const player = players.find(p => p.id === (best.pid || best.playerId));
  if (!player) return null;

  return `${fmt(player.name)} ${best.pts} PTS`;
}

function BoxScore({ game, players, onClose }) {
  const rows = (game.boxScore || [])
    .map(r => ({ ...r, player: players.find(p => p.id === r.pid) }))
    .filter(r => r.player && r.min > 0)
    .sort((a, b) => Number(a.player.number) - Number(b.player.number));

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, overflowY:"auto", padding:"80px 16px 32px", background:"rgba(0,0,0,0.82)" }} onClick={onClose}>
      <div style={{ maxWidth:900, margin:"0 auto", borderRadius:16, border:`1px solid ${C.border2}`, background:C.surface, overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", background:C.base, borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, textTransform:"uppercase", marginBottom:2 }}>{game.date}</div>
            <div style={{ fontSize:17, fontWeight:900, color:C.text }}>{game.home ? "vs" : "@"} {game.opponent} · <span style={{ color: game.result==="W" ? C.green : C.redText }}>{game.result} {game.score}</span></div>
          </div>
          <button onClick={onClose} style={{ fontSize:28, fontWeight:900, color:C.textDim, background:"none", border:"none", cursor:"pointer" }}>×</button>
        </div>
        <div style={{ overflowX:"auto", padding:"0 0 4px" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:700 }}>
            <thead>
              <tr style={{ background:C.base, borderBottom:`1px solid ${C.border2}` }}>
                <th style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontWeight:900, color:C.textDim, letterSpacing:"0.12em", minWidth:48 }}>#</th>
                <th style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontWeight:900, color:C.textDim, letterSpacing:"0.12em", minWidth:150 }}>PLAYER</th>
                {BOX_COLS.map(c => <th key={c.key} style={{ padding:"8px 8px", fontSize:10, fontWeight:900, color:c.key==="eff"?C.redText:C.textDim, letterSpacing:"0.1em", minWidth:44, textAlign:"center" }}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.pid} style={{ background: i%2===0 ? C.surface : C.surface2, borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"8px 12px", fontWeight:700, color:C.textDim }}>{r.player.number}</td>
                  <td style={{ padding:"8px 12px" }}>
                    <div style={{ fontWeight:700, color:C.text, fontSize:13 }}>{fmt(r.player.name)}</div>
                    <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.1em" }}>{r.player.position}</div>
                  </td>
                  {BOX_COLS.map(c => (
                    <td key={c.key} style={{ padding:"8px 8px", textAlign:"center", color: c.key==="eff" ? (r[c.key] >= 15 ? C.redText : r[c.key] < 0 ? "#ff4444" : C.textSub) : c.key==="pts" && r.pts >= 15 ? C.redText : C.textSub, fontWeight: c.key==="pts"||c.key==="eff" ? 900 : 400 }}>
                      {r[c.key] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div style={{ padding:32, textAlign:"center", color:C.textDim, fontSize:13 }}>No box score recorded for this game.</div>
        )}
      </div>
    </div>
  );
}

export default function GamesPage({ games, players }) {
  const [selected, setSelected] = useState(null);
  const sorted = [...games].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <Layout title="Game Results">
      <SectionHeading label="2025–26 Season" title="Game Results" right={`${games.length} Games`} />

      {games.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:C.textDim }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No games recorded yet</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sorted.map(g => {
            // B-04: derive topScorer from box score rows — was previously
            // referencing g.topScorer which is never set by the repository.
            const topScorer = getTopScorer(g, players);

            return (
              <button key={g.id} onClick={() => setSelected(g)} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"14px 18px", borderRadius:12, border:`1px solid ${C.border}`,
                background:C.surface, cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                transition:"border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor=`${C.redBright}55`}
              onMouseLeave={e => e.currentTarget.style.borderColor=C.border}
              >
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{
                    width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:900, flexShrink:0,
                    background: g.result==="W" ? `${C.green}20` : `${C.red}30`,
                    color: g.result==="W" ? C.green : C.redText,
                    border: `1px solid ${g.result==="W" ? `${C.green}40` : `${C.redText}30`}`,
                  }}>{g.result}</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{g.home ? "vs" : "@"} {g.opponent}</div>
                    <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{g.date}</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:24 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{g.score}</div>
                    {/* B-04: now renders when box score data is present */}
                    {topScorer && <div style={{ fontSize:11, color:C.textDim }}>{topScorer}</div>}
                  </div>
                  <div style={{ fontSize:11, color:C.textDim }}>BOX SCORE →</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {selected && <BoxScore game={selected} players={players} onClose={() => setSelected(null)} />}
    </Layout>
  );
}

export async function getStaticProps() {
  const { games, players } = await getAllPublicData();
  return { props: { games, players }, revalidate: 3600 };
}