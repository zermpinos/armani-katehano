/**
 * pages/admin/[slug].js
 *
 * Secret-URL admin panel.
 * - Wrong slug -> renders identical 404 (no information leak)
 * - Correct slug -> login form (HMAC session cookie, brute-force protection)
 * - Authenticated -> full dashboard:
 *     · Season Record editor
 *     · Roster manager (add / edit / delete)
 *     · PDF Import -> Anthropic extraction -> FULL STAT CONFIRMATION before saving
 *     · Manual Game Entry with box score
 *     · Schedule manager
 */

import { useState, useCallback, useRef, useEffect } from "react";
import Head from "next/head";
import { C } from "../../lib/theme";

// ── Tiny inline UI primitives (no shared import -- admin is self-contained) ───
const F = ({ label, value, onChange, type="text", placeholder="", sm=false }) => (
  <div>
    {label && <label style={{ display:"block", fontSize:10, fontWeight:900, letterSpacing:"0.15em", marginBottom:5, color:C.textDim, textTransform:"uppercase" }}>{label}</label>}
    <input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ width:"100%", padding:sm?"5px 8px":"9px 12px", fontSize:sm?11:13, borderRadius:8,
        border:`1px solid ${C.border2}`, background:C.base, color:C.text, fontFamily:"inherit", outline:"none" }} />
  </div>
);
const Sel = ({ label, value, onChange, options }) => (
  <div>
    {label && <label style={{ display:"block", fontSize:10, fontWeight:900, letterSpacing:"0.15em", marginBottom:5, color:C.textDim, textTransform:"uppercase" }}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:"100%", padding:"9px 12px", fontSize:13, borderRadius:8, border:`1px solid ${C.border2}`, background:C.base, color:C.text, fontFamily:"inherit", outline:"none" }}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Btn = ({ children, onClick, variant="primary", size="md", disabled=false, type="button" }) => {
  const bg  = variant==="primary"?C.red:variant==="danger"?"#7f1d1d":variant==="green"?C.greenDim:"transparent";
  const bc  = variant==="ghost"?C.border2:"transparent";
  const col = variant==="ghost"?C.textSub:C.text;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding:size==="sm"?"5px 12px":"9px 18px", fontSize:size==="sm"?11:13, fontWeight:900,
      letterSpacing:"0.1em", borderRadius:8, border:`1px solid ${bc}`, background:bg, color:col,
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, fontFamily:"inherit",
    }}>{children}</button>
  );
};
const Toast = ({ msg, type, onDone }) => {
  useEffect(()=>{ const t=setTimeout(onDone,2800); return()=>clearTimeout(t); },[]);
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:300, display:"flex", alignItems:"center", gap:10, borderRadius:12, padding:"12px 20px", background:C.surface2, color:C.text, fontSize:14, fontWeight:600, border:`1px solid ${type==="success"?`${C.green}60`:`${C.redText}60`}`, boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
      {type==="success"?"✓":"✕"} {msg}
    </div>
  );
};
const Confirm = ({ msg, onConfirm, onCancel }) => (
  <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.75)" }}>
    <div style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:16, padding:24, maxWidth:360, width:"90%" }}>
      <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:8 }}>Are you sure?</div>
      <div style={{ fontSize:13, color:C.textSub, marginBottom:24 }}>{msg}</div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>Delete</Btn>
      </div>
    </div>
  </div>
);
const Section = ({ title, icon, children }) => (
  <div style={{ borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:20 }}>
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 20px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:18 }}>{icon}</span>
      <span style={{ fontSize:12, fontWeight:900, letterSpacing:"0.15em", textTransform:"uppercase", color:C.text }}>{title}</span>
    </div>
    <div style={{ padding:20, background:C.surface }}>{children}</div>
  </div>
);

// ── League options ────────────────────────────────────────────────────────────
const LEAGUE_OPTIONS = [
  { value: "",       label: "-- Unassigned --"  },
  { value: "rookie", label: "Rookie League"   },
  { value: "bc6",    label: "BC6"             },
];

// ── Box score columns ─────────────────────────────────────────────────────────
const BOX_COLS = [
  {key:"min",label:"MIN"},{key:"pts",label:"PTS"},{key:"reb",label:"REB"},{key:"ast",label:"AST"},
  {key:"stl",label:"STL"},{key:"blk",label:"BLK"},{key:"tov",label:"TOV"},
  {key:"fgm",label:"FGM"},{key:"fga",label:"FGA"},{key:"fg3m",label:"3PM"},{key:"fg3a",label:"3PA"},
  {key:"ftm",label:"FTM"},{key:"fta",label:"FTA"},
];

const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const byJersey = (a, b) => Number(a.number) - Number(b.number);

// ── AdminPlayers ──────────────────────────────────────────────────────────────
function AdminPlayers({ players, onSave, showToast }) {
  const [editId, setEditId] = useState(null);
  const [draft,  setDraft]  = useState({});
  const [confirm,setConfirm]= useState(null);
  const POSITIONS = ["PG","SG","SF","PF","C","PG/SG","PG/SF","SG/SF","SF/PF","PF/C","PG/SG/SF"];

  const startEdit = p => { setDraft({ ...p, stats: { ...p.stats } }); setEditId(p.id); };
  const startNew  = () => {
    setDraft({ id:uid(), name:"", number:"", position:"PG", height:"", weight:"", age:"", photoUrl:"",
      stats:{ ppg:0,rpg:0,apg:0,spg:0,bpg:0,tpg:0,fgPct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0 }, gameLog:[] });
    setEditId("new");
  };
  const cancel  = () => { setEditId(null); setDraft({}); };
  const upd     = (k,v) => setDraft(d=>({ ...d, [k]:v }));
  const updStat = (k,v) => setDraft(d=>({ ...d, stats:{ ...d.stats, [k]:parseFloat(v)||0 } }));

  const save = async () => {
    const updated = editId==="new" ? [...players, draft] : players.map(p=>p.id===editId?draft:p);
    await onSave(updated);
    showToast(editId==="new"?"Player added!":"Player saved!");
    cancel();
  };

  const editForm = (
    <div style={{ borderRadius:12, border:`1px solid ${C.redBright}40`, padding:16, background:C.base, marginTop:8 }}>
      <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", color: editId==="new"?C.green:C.redText, marginBottom:12, textTransform:"uppercase" }}>
        {editId==="new"?"NEW PLAYER":`EDITING: ${draft.name || "..."}`}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:10, marginBottom:12 }}>
        <F label="FULL NAME"  value={draft.name}     onChange={v=>upd("name",v)} />
        <F label="JERSEY #"   value={draft.number}   onChange={v=>upd("number",v)}   type="number" />
        <Sel label="POSITION" value={draft.position} onChange={v=>upd("position",v)} options={POSITIONS.map(p=>({value:p,label:p}))} />
        <F label="AGE"        value={draft.age}       onChange={v=>upd("age",v)}      type="number" />
        <F label="HEIGHT"     value={draft.height}    onChange={v=>upd("height",v)}   placeholder='e.g. 6&apos;4"' />
        <F label="WEIGHT"     value={draft.weight}    onChange={v=>upd("weight",v)}   placeholder="e.g. 90 kg" />
        <F label="PHOTO URL"  value={draft.photoUrl}  onChange={v=>upd("photoUrl",v)} placeholder="https://..." />
      </div>
      <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:8, paddingTop:8, borderTop:`1px solid ${C.border}`, textTransform:"uppercase" }}>Season Averages</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))", gap:8, marginBottom:12 }}>
        {["ppg","rpg","apg","spg","bpg","tpg","fgPct","fg3Pct","ftPct","mpg","eff"].map(k=>(
          <F key={k} label={k.toUpperCase()} value={draft.stats?.[k]??0} onChange={v=>updStat(k,v)} type="number" sm />
        ))}
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <Btn onClick={save}>{editId==="new"?"ADD PLAYER":"SAVE PLAYER"}</Btn>
        <Btn variant="ghost" onClick={cancel}>CANCEL</Btn>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <Btn onClick={startNew}>+ ADD PLAYER</Btn>
      </div>
      {editId==="new" && editForm}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {[...players].sort(byJersey).map(p=>(
          <div key={p.id}>
            {editId===p.id ? editForm : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, background:C.red, color:C.text }}>#{p.number}</div>
                  <div>
                    <div style={{ fontWeight:900, fontSize:13, color:C.text }}>{p.name}</div>
                    <div style={{ fontSize:11, color:C.textDim }}>{p.position} · {p.stats.ppg} PPG · {p.stats.rpg} RPG · {p.stats.apg} APG</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Btn size="sm" variant="ghost" onClick={()=>startEdit(p)}>EDIT</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>setConfirm(p.id)}>DEL</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {confirm && <Confirm msg={`Delete ${players.find(p=>p.id===confirm)?.name}?`} onConfirm={async()=>{ await onSave(players.filter(p=>p.id!==confirm)); showToast("Player deleted."); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ── AdminGames ────────────────────────────────────────────────────────────────
function AdminGames({ players, games, onSave, showToast }) {
  const [editId,  setEditId]  = useState(null);
  const [draft,   setDraft]   = useState({});
  const [confirm, setConfirm] = useState(null);

  const emptyRow  = pid => ({ pid, min:0, pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, fg3m:0, fg3a:0, ftm:0, fta:0 });
  const buildBoxScore = existing => [...players].sort(byJersey).map(p => existing?.find(r=>r.pid===p.id) || emptyRow(p.id));

  const startNew  = () => { setDraft({ id:uid(), date:"", opponent:"", home:true, result:"W", score:"", league:"", boxScore: buildBoxScore([]) }); setEditId("new"); };
  const startEdit = g  => { setDraft({ ...g, league: g.league||"", boxScore: buildBoxScore(g.boxScore) }); setEditId(g.id); };
  const cancel    = () => { setEditId(null); setDraft({}); };

  const updGame = (k,v) => setDraft(d=>({ ...d, [k]:v }));
  const updBox  = (pid,k,v) => setDraft(d=>({ ...d, boxScore: d.boxScore.map(r=>r.pid===pid?{...r,[k]:parseFloat(v)||0}:r) }));

  const save = async () => {
    const best = draft.boxScore.reduce((b,r)=>r.pts>b.pts?r:b, draft.boxScore[0]);
    const bpl  = players.find(p=>p.id===best?.pid);
    const topScorer = bpl&&best.pts>0 ? `${bpl.name.split(" ").slice(-1)[0]} ${best.pts}pts` : "";
    const finalDraft = { ...draft, topScorer };
    const updated = editId==="new" ? [...games, finalDraft] : games.map(g=>g.id===editId?finalDraft:g);
    await onSave(updated);
    showToast(editId==="new"?"Game added!":"Game saved!");
    cancel();
  };

  const gameForm = (
    <div style={{ borderRadius:12, border:`1px solid ${editId==="new"?`${C.green}40`:`${C.redBright}40`}`, padding:16, background:C.base, marginTop:8 }}>
      <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", color:editId==="new"?C.green:C.redText, marginBottom:12, textTransform:"uppercase" }}>
        {editId==="new"?"NEW GAME":"EDITING GAME"}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:12 }}>
        <F label="DATE" value={draft.date} onChange={v=>updGame("date",v)} placeholder="e.g. 08/03/2026" />
        <F label="OPPONENT" value={draft.opponent} onChange={v=>updGame("opponent",v)} />
        <Sel label="HOME/AWAY" value={draft.home?"home":"away"} onChange={v=>updGame("home",v==="home")} options={[{value:"home",label:"Home"},{value:"away",label:"Away"}]} />
        <Sel label="RESULT" value={draft.result} onChange={v=>updGame("result",v)} options={[{value:"W",label:"Win"},{value:"L",label:"Loss"}]} />
        <F label="SCORE" value={draft.score} onChange={v=>updGame("score",v)} placeholder="e.g. 88-74" />
        <Sel label="LEAGUE" value={draft.league||""} onChange={v=>updGame("league",v)} options={LEAGUE_OPTIONS} />
      </div>
      <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:8, paddingTop:8, borderTop:`1px solid ${C.border}`, textTransform:"uppercase" }}>Box Score</div>
      <BoxScoreTable players={players} rows={draft.boxScore||[]} onUpdate={updBox} />
      <div style={{ display:"flex", gap:10, marginTop:12 }}>
        <Btn onClick={save}>{editId==="new"?"SAVE GAME":"SAVE GAME"}</Btn>
        <Btn variant="ghost" onClick={cancel}>CANCEL</Btn>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <Btn onClick={startNew}>+ ADD GAME</Btn>
      </div>
      {editId==="new" && gameForm}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {[...games].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(g=>(
          <div key={g.id}>
            {editId===g.id ? gameForm : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, background:g.result==="W"?`${C.green}25`:`${C.red}25`, color:g.result==="W"?C.green:C.redText }}>{g.result}</span>
                  <div>
                    <div style={{ fontWeight:900, fontSize:13, color:C.text }}>{g.home?"vs":"@"} {g.opponent}</div>
                    <div style={{ fontSize:11, color:C.textDim }}>{g.date} · {g.score}{g.league ? ` · ${g.league==="rookie"?"Rookie":g.league==="bc6"?"BC6":""}` : ""}{g.topScorer?` · ${g.topScorer}`:""}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Btn size="sm" variant="ghost" onClick={()=>startEdit(g)}>EDIT</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>setConfirm(g.id)}>DEL</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {confirm && <Confirm msg={`Delete game vs ${games.find(g=>g.id===confirm)?.opponent}?`} onConfirm={async()=>{ await onSave(games.filter(g=>g.id!==confirm)); showToast("Game deleted."); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ── Shared box score table ────────────────────────────────────────────────────
function BoxScoreTable({ players, rows, onUpdate, readOnly=false, highlights={} }) {
  return (
    <div style={{ overflowX:"auto", borderRadius:10, border:`1px solid ${C.border}` }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:700 }}>
        <thead>
          <tr style={{ background:C.surface2, borderBottom:`1px solid ${C.border2}` }}>
            <th style={{ padding:"7px 10px", textAlign:"left", fontSize:9, fontWeight:900, color:C.textDim, minWidth:36, letterSpacing:"0.12em" }}>#</th>
            <th style={{ padding:"7px 10px", textAlign:"left", fontSize:9, fontWeight:900, color:C.textDim, minWidth:150, letterSpacing:"0.12em" }}>PLAYER</th>
            {BOX_COLS.map(c=><th key={c.key} style={{ padding:"7px 6px", fontSize:9, fontWeight:900, color:C.textDim, minWidth:44, textAlign:"center", letterSpacing:"0.1em" }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const pl = players.find(p=>p.id===row.pid);
            if (!pl) return null;
            const hl = highlights[row.pid];
            return (
              <tr key={row.pid} style={{ background: hl ? `${C.green}12` : C.surface, borderBottom:`1px solid ${C.border}` }}>
                <td style={{ padding:"5px 10px", fontWeight:700, color: hl ? C.green : C.textDim }}>
                  <span style={{ padding:"2px 5px", borderRadius:4, background: hl?`${C.green}22`:C.border, fontSize:10 }}>{pl.number}</span>
                </td>
                <td style={{ padding:"5px 10px" }}>
                  <div style={{ fontWeight:700, color: hl ? C.text : C.textSub, fontSize:12 }}>{pl.name}</div>
                </td>
                {BOX_COLS.map(c=>(
                  <td key={c.key} style={{ padding:"3px 3px", textAlign:"center" }}>
                    {readOnly
                      ? <span style={{ fontWeight: c.key==="pts"||c.key==="eff"?900:400, color: c.key==="pts"&&row.pts>=15?C.redText:C.textSub }}>{row[c.key]??0}</span>
                      : <input type="number" value={row[c.key]??0} onChange={e=>onUpdate(row.pid,c.key,e.target.value)}
                          style={{ width:40, textAlign:"center", fontSize:11, padding:"4px 2px", borderRadius:6, border:`1px solid ${C.border}`, background:C.surface2, color:C.text, fontFamily:"inherit", outline:"none" }} />
                    }
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── AdminImport -- score sheet image -> Claude vision -> confirm & save ──────────
function AdminImport({ players, games, onSaveGame, showToast }) {
  const [tab,       setTab]       = useState("extract"); // extract | import
  const [phase,     setPhase]     = useState("idle");    // idle | loading | confirm
  const [result,    setResult]    = useState(null);
  const [draft,     setDraft]     = useState(null);
  const [error,     setError]     = useState("");
  const [fileName,  setFileName]  = useState("");
  const [dragging,  setDragging]  = useState(false);
  const [jsonText,  setJsonText]  = useState("");
  const [copied,    setCopied]    = useState(false);
  const fileRef = useRef();

  // ── Shared: build editable boxScore + highlights from API data ─────────────
  const buildDraft = (data) => {
    const mi  = data.match_info;
    const ak  = data.armani_katehano;
    const sortedPlayers = [...players].sort(byJersey);

    const boxScore = sortedPlayers.map(p => {
      const parsed = ak.players.find(pp => pp.jersey_number === Number(p.number));
      if (!parsed || parsed.did_not_play) {
        return { pid:p.id, min:0, pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, fg3m:0, fg3a:0, ftm:0, fta:0 };
      }
      return {
        pid:  p.id,
        min:  parsed.minutes_played?.total_seconds ? Math.round(parsed.minutes_played.total_seconds / 60) : 0,
        pts:  parsed.points,
        reb:  parsed.total_rebounds,
        ast:  parsed.assists,
        stl:  parsed.steals,
        blk:  parsed.blocks,
        tov:  parsed.turnovers,
        fgm:  (parsed.two_point_fg?.made ?? 0) + (parsed.three_point_fg?.made ?? 0),
        fga:  (parsed.two_point_fg?.attempted ?? 0) + (parsed.three_point_fg?.attempted ?? 0),
        fg3m: parsed.three_point_fg?.made ?? 0,
        fg3a: parsed.three_point_fg?.attempted ?? 0,
        ftm:  parsed.free_throws?.made ?? 0,
        fta:  parsed.free_throws?.attempted ?? 0,
        eff:  parsed.efficiency ?? 0,
      };
    });

    const highlights = {};
    ak.players.filter(p => !p.did_not_play).forEach(p => {
      const player = players.find(pl => Number(pl.number) === p.jersey_number);
      if (player) highlights[player.id] = true;
    });

    return {
      draft: {
        id:       uid(),
        date:     mi.date || "",
        opponent: mi.opponent || "",
        home:     mi.home_team?.includes("ARMANI") || mi.home_team?.includes("KATEHANO"),
        result:   mi.result || "W",
        score:    mi.armani_katehano_score != null
          ? `${mi.armani_katehano_score}-${mi.opponent_score}`
          : "",
        league:   mi.league || "",
        boxScore,
      },
      highlights,
      activePlayers: ak.players.filter(p => !p.did_not_play).length,
    };
  };

  // ── TAB 1: Upload image -> call /api/convert -> show preview + copy JSON ─────
  const processImage = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["jpg","jpeg","png"].includes(ext)) {
      setError("Please upload a JPG or PNG score sheet image."); return;
    }
    setFileName(file.name);
    setPhase("loading");
    setError("");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Failed to read file"));
        r.readAsDataURL(file);
      });

      const res = await fetch("/api/convert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, filename: file.name }),
      });

      if (res.status === 401) { window.location.reload(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      const { draft, highlights, activePlayers } = buildDraft(data.data);
      setResult({ ...data.data, highlights, activePlayers });
      setDraft(draft);
      // Pre-fill the import tab's JSON box so user can copy and re-paste if needed
      setJsonText(JSON.stringify(data.data, null, 2));
      setPhase("confirm");
    } catch (err) {
      setError(err.message);
      setPhase("idle");
    }
  }, [players]);

  // ── TAB 2: Paste JSON -> parse -> go straight to confirm ────────────────────
  const importJson = () => {
    setError("");
    try {
      const data = JSON.parse(jsonText.trim());
      if (!data.match_info || !data.armani_katehano?.players)
        throw new Error("JSON is missing match_info or armani_katehano.players");
      const { draft, highlights, activePlayers } = buildDraft(data);
      setResult({ ...data, highlights, activePlayers });
      setDraft(draft);
      setPhase("confirm");
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
    }
  };

  const copyJson = () => {
    navigator.clipboard.writeText(jsonText).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Shared: confirm screen handlers ───────────────────────────────────────
  const updDraft = (k,v)     => setDraft(d=>({ ...d, [k]:v }));
  const updBox   = (pid,k,v) => setDraft(d=>({ ...d, boxScore: d.boxScore.map(r=>r.pid===pid?{...r,[k]:parseFloat(v)||0}:r) }));

  const confirmSave = async () => {
    const best = draft.boxScore.reduce((b,r)=>r.pts>b.pts?r:b, draft.boxScore[0]);
    const bpl  = players.find(p=>p.id===best?.pid);
    const topScorer = bpl&&best.pts>0 ? `${bpl.name.split(" ").slice(-1)[0]} ${best.pts}pts` : "";
    await onSaveGame([...games, { ...draft, topScorer }]);
    showToast("Game saved!");
    setPhase("idle"); setDraft(null); setResult(null); setJsonText("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const reset = () => { setPhase("idle"); setDraft(null); setResult(null); setError(""); };

  const mi = result?.match_info;

  // Tab styles
  const tabStyle = (active) => ({
    flex:1, padding:"8px 0", fontSize:11, fontWeight:900, letterSpacing:"0.12em",
    textTransform:"uppercase", textAlign:"center", cursor:"pointer", borderRadius:8,
    background: active ? C.red : "transparent",
    color: active ? C.text : C.textDim,
    border: "none", fontFamily:"inherit",
  });

  return (
    <div>
      {/* ── Confirm screen (shared by both tabs) ────────────────────────────── */}
      {phase === "confirm" && draft && (
        <div>
          <div style={{ borderRadius:10, padding:16, background:C.base, border:`1px solid ${C.border}`, marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", color:C.green, marginBottom:8, textTransform:"uppercase" }}>
              ✓ EXTRACTED -- {result?.activePlayers} players detected -- REVIEW ALL STATS BELOW
            </div>
            <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:22, fontWeight:900, color:C.text }}>
                <span style={{ color: draft.result==="W"?C.green:C.redText }}>{draft.score?.split("-")[0]}</span>
                <span style={{ color:C.textDim }}> - </span>
                <span style={{ color: draft.result==="L"?C.green:C.redText }}>{draft.score?.split("-")[1]}</span>
              </span>
              <span style={{ fontSize:13, fontWeight:700, padding:"3px 10px", borderRadius:6, background: draft.result==="W"?`${C.green}20`:`${C.red}20`, color:draft.result==="W"?C.green:C.redText }}>
                {draft.result==="W"?"WIN":"LOSS"}
              </span>
              {mi?.competition && <span style={{ fontSize:11, color:C.textDim }}>{mi.competition} · MD {mi?.matchday}</span>}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
            <F label="DATE"      value={draft.date}     onChange={v=>updDraft("date",v)}    placeholder="08/03/2026" />
            <F label="OPPONENT"  value={draft.opponent} onChange={v=>updDraft("opponent",v)} />
            <Sel label="HOME/AWAY" value={draft.home?"home":"away"} onChange={v=>updDraft("home",v==="home")} options={[{value:"home",label:"Home"},{value:"away",label:"Away"}]} />
            <Sel label="RESULT"  value={draft.result}   onChange={v=>updDraft("result",v)}  options={[{value:"W",label:"Win"},{value:"L",label:"Loss"}]} />
            <F label="SCORE"     value={draft.score}    onChange={v=>updDraft("score",v)}   placeholder="88-74" />
            <Sel label="LEAGUE"  value={draft.league||""} onChange={v=>updDraft("league",v)} options={LEAGUE_OPTIONS} />
          </div>

          <div style={{ display:"flex", gap:16, marginBottom:10, flexWrap:"wrap", fontSize:11, color:C.textDim }}>
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ width:10, height:10, borderRadius:2, background:`${C.green}60`, display:"inline-block" }} /> Auto-filled</span>
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ width:10, height:10, borderRadius:2, background:C.border2, display:"inline-block" }} /> Did not play</span>
            <span style={{ color:C.redText }}>⚠ Review carefully before saving</span>
          </div>

          <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:8, textTransform:"uppercase" }}>
            Box Score -- jersey order · green = auto-filled
          </div>
          <BoxScoreTable players={players} rows={draft.boxScore} onUpdate={updBox} highlights={result?.highlights||{}} />

          <div style={{ display:"flex", gap:10, marginTop:16 }}>
            <Btn variant="green" onClick={confirmSave}>✓ CONFIRM & SAVE</Btn>
            <Btn variant="ghost" onClick={reset}>← BACK</Btn>
          </div>
        </div>
      )}

      {/* ── Loading spinner ──────────────────────────────────────────────────── */}
      {phase === "loading" && (
        <div style={{ textAlign:"center", padding:"32px 0" }}>
          <div style={{ width:36, height:36, borderRadius:"50%", border:`2px solid ${C.border2}`, borderTopColor:C.redBright, animation:"spin 0.7s linear infinite", margin:"0 auto 16px" }} />
          <div style={{ fontSize:13, fontWeight:900, letterSpacing:"0.15em", color:C.text, textTransform:"uppercase" }}>Reading score sheet...</div>
          <div style={{ fontSize:11, color:C.textDim, marginTop:6 }}>{fileName}</div>
        </div>
      )}

      {/* ── Idle: two tabs ───────────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div>
          {/* Tab switcher */}
          <div style={{ display:"flex", gap:4, padding:4, borderRadius:10, background:C.base, border:`1px solid ${C.border}`, marginBottom:16 }}>
            <button style={tabStyle(tab==="extract")} onClick={()=>{ setTab("extract"); setError(""); }}>🖼 Extract from Image</button>
            <button style={tabStyle(tab==="import")}  onClick={()=>{ setTab("import");  setError(""); }}>📋 Paste JSON</button>
          </div>

          {/* Extract tab */}
          {tab === "extract" && (
            <div>
              <div
                onDrop={e=>{ e.preventDefault(); setDragging(false); processImage(e.dataTransfer.files[0]); }}
                onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
                onDragLeave={()=>setDragging(false)}
                onClick={()=>fileRef.current?.click()}
                style={{ border:`2px dashed ${dragging?C.redBright:C.border2}`, borderRadius:12, padding:"40px 24px", textAlign:"center", cursor:"pointer", background:dragging?`${C.red}08`:C.base, transition:"all 0.2s" }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🖼</div>
                <div style={{ fontSize:12, fontWeight:900, letterSpacing:"0.12em", color:C.textSub }}>DRAG & DROP OR CLICK TO UPLOAD</div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:6 }}>Basket City score sheet image (JPG / PNG)</div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={e=>processImage(e.target.files[0])} />
              </div>
              <div style={{ marginTop:12, padding:12, borderRadius:10, border:`1px solid ${C.border}`, background:C.base, fontSize:11, color:C.textSub, lineHeight:1.8 }}>
                <div style={{ fontWeight:900, color:C.textDim, marginBottom:4, letterSpacing:"0.1em", textTransform:"uppercase" }}>How it works</div>
                1. Upload the Basket City score sheet JPG<br />
                2. Claude reads the image and extracts all stats automatically<br />
                3. Review every stat, edit if needed, then confirm<br />
                4. Player season averages auto-recalculate on save
              </div>
            </div>
          )}

          {/* Import tab */}
          {tab === "import" && (
            <div>
              <div style={{ fontSize:11, color:C.textSub, marginBottom:8, lineHeight:1.7 }}>
                Paste the JSON output from the extractor tool, then click Import.
              </div>
              <textarea
                value={jsonText}
                onChange={e=>setJsonText(e.target.value)}
                placeholder={'{\n  "match_info": { ... },\n  "armani_katehano": { "players": [ ... ] }\n}'}
                spellCheck={false}
                style={{ width:"100%", minHeight:180, padding:12, fontSize:11, fontFamily:"monospace", borderRadius:10, border:`1px solid ${C.border2}`, background:C.base, color:C.text, resize:"vertical", outline:"none", boxSizing:"border-box" }}
              />
              <div style={{ display:"flex", gap:10, marginTop:10 }}>
                <Btn onClick={importJson} disabled={!jsonText.trim()}>IMPORT</Btn>
                <Btn variant="ghost" onClick={()=>setJsonText("")}>CLEAR</Btn>
              </div>
            </div>
          )}

          {error && <div style={{ marginTop:10, fontSize:12, color:C.redText }}>⚠ {error}</div>}
        </div>
      )}

      {/* JSON copy panel -- shown after successful extraction, above confirm */}
      {phase === "confirm" && jsonText && (
        <div style={{ marginTop:16, padding:12, borderRadius:10, border:`1px solid ${C.border}`, background:C.base }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:900, letterSpacing:"0.12em", color:C.textDim, textTransform:"uppercase" }}>Extracted JSON (copy for Import tab)</span>
            <button onClick={copyJson} style={{ fontSize:11, padding:"3px 10px", borderRadius:6, border:`1px solid ${C.border2}`, background: copied?`${C.green}20`:"transparent", color: copied?C.green:C.textSub, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>
              {copied?"✓ Copied":"Copy"}
            </button>
          </div>
          <textarea readOnly value={jsonText} style={{ width:"100%", height:80, padding:8, fontSize:10, fontFamily:"monospace", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface2, color:C.textSub, resize:"none", outline:"none", boxSizing:"border-box" }} />
        </div>
      )}
    </div>
  );
}

// ── AdminSchedule ─────────────────────────────────────────────────────────────
function AdminSchedule({ schedule, onSave, showToast }) {
  const [editId, setEditId] = useState(null);
  const [draft,  setDraft]  = useState({});
  const [confirm,setConfirm]= useState(null);
  const up = (k,v) => setDraft(d=>({ ...d, [k]:v }));

  const scheduleForm = (
    <div style={{ borderRadius:12, border:`1px solid ${editId==="new"?`${C.green}40`:`${C.redBright}40`}`, padding:16, background:C.base, marginTop:8 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10, marginBottom:12 }}>
        <F label="DATE"     value={draft.date}     onChange={v=>up("date",v)}     placeholder="e.g. 15/03/2026" />
        <F label="OPPONENT" value={draft.opponent} onChange={v=>up("opponent",v)} />
        <Sel label="HOME/AWAY" value={draft.home?"home":"away"} onChange={v=>up("home",v==="home")} options={[{value:"home",label:"Home"},{value:"away",label:"Away"}]} />
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <Btn onClick={async()=>{
          const updated = editId==="new" ? [...schedule,draft] : schedule.map(s=>s.id===editId?draft:s);
          await onSave(updated);
          showToast(editId==="new"?"Game added!":"Schedule updated!");
          setEditId(null); setDraft({});
        }}>SAVE</Btn>
        <Btn variant="ghost" onClick={()=>{ setEditId(null); setDraft({}); }}>CANCEL</Btn>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <Btn onClick={()=>{ setDraft({ id:uid(), date:"", opponent:"", home:true }); setEditId("new"); }}>+ ADD GAME</Btn>
      </div>
      {editId==="new" && scheduleForm}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {[...schedule].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(s=>(
          <div key={s.id}>
            {editId===s.id ? scheduleForm : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:10, fontWeight:900, padding:"3px 8px", borderRadius:6, background:s.home?`${C.red}25`:C.border2, color:s.home?C.redText:C.textSub, textTransform:"uppercase" }}>{s.home?"HOME":"AWAY"}</span>
                  <div>
                    <div style={{ fontWeight:900, fontSize:13, color:C.text }}>vs {s.opponent}</div>
                    <div style={{ fontSize:11, color:C.textDim }}>{s.date}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Btn size="sm" variant="ghost" onClick={()=>{ setDraft({...s}); setEditId(s.id); }}>EDIT</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>setConfirm(s.id)}>DEL</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {confirm && <Confirm msg={`Remove ${schedule.find(s=>s.id===confirm)?.opponent} from schedule?`} onConfirm={async()=>{ await onSave(schedule.filter(s=>s.id!==confirm)); showToast("Removed."); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────
export default function AdminPage({ validSlug }) {
  const [phase,        setPhase]        = useState(validSlug ? "login" : "404");
  const [password,     setPassword]     = useState("");
  const [authError,    setAuthError]    = useState("");
  const [authLoading,  setAuthLoading]  = useState(false);
  const [lockoutSecs,  setLockoutSecs]  = useState(0);
  const [dataLoading,  setDataLoading]  = useState(false);

  const [record,   setRecord]   = useState(null);
  const [players,  setPlayers]  = useState(null);
  const [games,    setGames]    = useState(null);
  const [schedule, setSchedule] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type="success") => setToast({ msg, type });

  // Load admin data after login
  const loadData = async () => {
    setDataLoading(true);
    try {
      const res  = await fetch("/api/admin/data");
      if (!res.ok) { setPhase("login"); return; }
      const data = await res.json();
      setRecord(data.record); setPlayers(data.players);
      setGames(data.games);   setSchedule(data.schedule);
      setPhase("dashboard");
    } catch { showToast("Failed to load data", "error"); }
    finally  { setDataLoading(false); }
  };

  // Generic save helper
  const save = async (key, value) => {
    const res = await fetch("/api/admin/data", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    // Refresh players after saving games (averages recalculated server-side)
    if (key === "games") {
      const fresh = await fetch("/api/admin/data").then(r=>r.json());
      setPlayers(fresh.players);
      setGames(fresh.games);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ password, slug: window.location.pathname.split("/").pop() }),
      });
      if (res.ok) { setPassword(""); loadData(); }
      else {
        const d = await res.json();
        if (res.status === 429) { setLockoutSecs(d.retryAfter||900); setAuthError(`Too many attempts. Try again in ${Math.ceil((d.retryAfter||900)/60)} min.`); }
        else setAuthError("Invalid credentials.");
      }
    } catch { setAuthError("Network error. Please try again."); }
    finally { setAuthLoading(false); }
  };

  const logout = async () => { await fetch("/api/auth",{method:"DELETE"}); setPhase("login"); };

  const wrapSave = (key, setter) => async (value) => {
    try { await save(key, value); setter(value); }
    catch (err) { showToast(err.message, "error"); }
  };

  // ── Renders ──────────────────────────────────────────────────────────────
  const bg = { minHeight:"100vh", background:C.base, color:C.text, fontFamily:"'Trebuchet MS','Gill Sans',sans-serif" };

  if (phase === "404") return (
    <div style={{ ...bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Head><meta name="robots" content="noindex,nofollow,noarchive" /><title>404</title></Head>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:96, fontWeight:900, color:C.border }}>404</div>
        <div style={{ fontSize:14, color:C.textDim }}>Page not found</div>
      </div>
    </div>
  );

  if (phase === "login") return (
    <div style={{ ...bg, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <Head><meta name="robots" content="noindex,nofollow,noarchive" /><title>Admin</title></Head>
      <div style={{ width:"100%", maxWidth:360, borderRadius:20, padding:32, border:`1px solid ${C.border}`, background:C.surface }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:52, height:52, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", fontSize:22, background:`${C.red}18`, border:`1px solid ${C.red}45` }}>🔐</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.text }}>Admin Access</div>
          <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>Armani Katehano · Team Manager</div>
        </div>
        <form onSubmit={login} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <F label="PASSWORD" value={password} onChange={setPassword} type="password" placeholder="Enter password" />
          {authError && <div style={{ fontSize:12, color:C.redText }}>{authError}</div>}
          <button type="submit" disabled={authLoading||!password||lockoutSecs>0} style={{ padding:"12px", fontWeight:900, fontSize:14, letterSpacing:"0.12em", textTransform:"uppercase", borderRadius:10, border:"none", background:C.red, color:C.text, cursor:"pointer", fontFamily:"inherit", opacity:authLoading||!password?0.5:1 }}>
            {authLoading?"VERIFYING...":"SIGN IN"}
          </button>
        </form>
        <div style={{ textAlign:"center", fontSize:10, color:C.textDim, marginTop:16, lineHeight:1.8 }}>5 failed attempts -> 15-minute lockout</div>
      </div>
    </div>
  );

  if (dataLoading || !record) return (
    <div style={{ ...bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:36, height:36, borderRadius:"50%", border:`2px solid ${C.border2}`, borderTopColor:C.redBright, animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={bg}>
      <Head><meta name="robots" content="noindex,nofollow,noarchive" /><title>Admin · Armani Katehano</title></Head>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} input,select{outline:none}`}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ height:3, background:`linear-gradient(90deg,${C.red},${C.redBright},${C.red})` }} />
        <div style={{ maxWidth:960, margin:"0 auto", padding:"0 16px", display:"flex", justifyContent:"space-between", alignItems:"center", height:56 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:12, background:C.red, color:C.text }}>AK</div>
            <div>
              <div style={{ fontWeight:900, fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color:C.text }}>Armani Katehano</div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.15em", color:C.redText }}>ADMIN PANEL</div>
            </div>
          </div>
          <button onClick={logout} style={{ fontSize:11, fontWeight:900, padding:"6px 14px", borderRadius:8, border:`1px solid ${C.border2}`, background:"transparent", color:C.textDim, cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.12em" }}>LOGOUT</button>
        </div>
      </div>

      <div style={{ maxWidth:960, margin:"0 auto", padding:"24px 16px" }}>
        {/* Summary */}
        {(() => {
          const wins   = games?.filter(g => g.result === "W").length ?? 0;
          const losses = games?.filter(g => g.result === "L").length ?? 0;
          return (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:24 }}>
              {[["RECORD",`${wins}-${losses}`],["PLAYERS",players?.length],["GAMES",games?.length],["UPCOMING",schedule?.length]].map(([l,v])=>(
                <div key={l} style={{ borderRadius:10, padding:"12px", textAlign:"center", border:`1px solid ${C.border}`, background:C.surface }}>
                  <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:24, fontWeight:900, color:C.text }}>{v}</div>
                </div>
              ))}
            </div>
          );
        })()}

        <Section title="Roster" icon="👤">
          <AdminPlayers players={players} onSave={async v=>{ await save("players",v); setPlayers(v); }} showToast={showToast} />
        </Section>

        <Section title="Import Game" icon="🖼">
          <AdminImport players={players} games={games}
            onSaveGame={async v=>{ await save("games",v); }}
            showToast={showToast} />
        </Section>

        <Section title="Game Results" icon="🏀">
          <AdminGames players={players} games={games}
            onSave={async v=>{ await save("games",v); }}
            showToast={showToast} />
        </Section>

        <Section title="Schedule" icon="📅">
          <AdminSchedule schedule={schedule} onSave={async v=>{ await save("schedule",v); setSchedule(v); }} showToast={showToast} />
        </Section>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { slug } = params;
  const expected = process.env.ADMIN_SLUG;
  let validSlug  = false;
  try {
    const crypto = await import("crypto");
    const a = Buffer.from(slug || "");
    const b = Buffer.from(expected || "");
    if (a.length === b.length) validSlug = crypto.timingSafeEqual(a, b);
  } catch { validSlug = slug === expected; }
  return { props: { validSlug } };
}
