import React from "react";

interface SeasonSelectorProps {
  seasons: string[];
  currentSeason: string;
  onChange: (sid: string) => void;
  showAllTime?: boolean;
  right?: React.ReactNode;
}

export default function SeasonSelector({ seasons, currentSeason, onChange, showAllTime = true, right }: SeasonSelectorProps) {
  if (!seasons || seasons.length === 0) return null;

  const showSelector = seasons.length > 1 || showAllTime;
  if (!showSelector && !right) return null;

  const tabs = [...seasons].sort().reverse();
  const options = showAllTime ? [...tabs, "all-time"] : tabs;

  const label = (sid: string) => {
    if (sid === "all-time") return "All Time";
    return sid.replace(/-/g, "–");
  };

  return (
    <div className="flex items-center justify-between gap-2 mb-5">
      {showSelector && (
        <div className="flex gap-1.5 flex-wrap">
          {options.map(sid => {
            const active = sid === currentSeason;
            return (
              <button
                key={sid}
                onClick={() => onChange(sid)}
                className={[
                  "py-[5px] px-[14px] text-[11px] font-black tracking-[0.12em] uppercase rounded-lg border cursor-pointer font-sans transition-all duration-150",
                  active
                    ? "border-[#c0392b] bg-[#8b1a1a30] text-ak-red-text"
                    : "border-ak-border bg-transparent text-ak-text-dim",
                ].join(" ")}
              >
                {label(sid)}
              </button>
            );
          })}
        </div>
      )}
      {right && (
        <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim shrink-0">
          {right}
        </div>
      )}
    </div>
  );
}
