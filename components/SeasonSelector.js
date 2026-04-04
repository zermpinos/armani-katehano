/**
 * components/SeasonSelector.js
 * Reusable season tab strip used on all public pages that support season filtering.
 *
 * Props:
 *   seasons        string[]   all available season ids e.g. ["2025-26","2026-27"]
 *   currentSeason  string     the currently selected season id
 *   onChange       fn(sid)    called when user picks a different season
 *   showAllTime    bool       whether to show an "All Time" tab (default true)
 *   right          node       optional element aligned to the right of the tab strip
 */

import { C } from "../lib/theme";

export default function SeasonSelector({ seasons, currentSeason, onChange, showAllTime = true, right }) {
  if (!seasons || seasons.length === 0) return null;

  // Only render the selector when there is something to switch between
  const showSelector = seasons.length > 1 || showAllTime;
  if (!showSelector && !right) return null;

  const tabs = [...seasons].sort().reverse(); // newest first
  const options = showAllTime ? [...tabs, "all-time"] : tabs;

  const label = (sid) => {
    if (sid === "all-time") return "All Time";
    // "2025-26" -> "2025-26" (en-dash for display)
    return sid.replace(/-/g, "-");
  };

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:20 }}>
      {showSelector && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {options.map(sid => {
            const active = sid === currentSeason;
            return (
              <button
                key={sid}
                onClick={() => onChange(sid)}
                style={{
                  padding: "5px 14px",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  borderRadius: 8,
                  border: `1px solid ${active ? C.red : C.border}`,
                  background: active ? C.red : "transparent",
                  color: active ? C.text : C.textDim,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {label(sid)}
              </button>
            );
          })}
        </div>
      )}
      {right && <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, flexShrink:0 }}>{right}</div>}
    </div>
  );
}
