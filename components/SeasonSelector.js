/**
 * components/SeasonSelector.js
 * Reusable season tab strip used on all public pages that support season filtering.
 *
 * Props:
 *   seasons        string[]   all available season ids e.g. ["2025-26","2026-27"]
 *   currentSeason  string     the currently selected season id
 *   onChange       fn(sid)    called when user picks a different season
 *   showAllTime    bool       whether to show an "All Time" tab (default true)
 */

import { C } from "../lib/theme";

export default function SeasonSelector({ seasons, currentSeason, onChange, showAllTime = true }) {
  if (!seasons || seasons.length === 0) return null;

  // Only render the selector when there is something to switch between
  const showSelector = seasons.length > 1 || showAllTime;
  if (!showSelector) return null;

  const tabs = [...seasons].sort().reverse(); // newest first
  const options = showAllTime ? [...tabs, "all-time"] : tabs;

  const label = (sid) => {
    if (sid === "all-time") return "All Time";
    // "2025-26" -> "2025-26" (en-dash for display)
    return sid.replace("-", "-");
  };

  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
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
  );
}
