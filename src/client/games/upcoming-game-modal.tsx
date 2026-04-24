import { useEffect } from "react";
import { getCountdownInfo, formatGameTime, downloadIcsFile, buildGoogleCalendarUrl } from "@/client/home/calendar-utils";
import { GoogleCalIcon } from "@/client/home/google-cal-icon";
import { getVenueUrl } from "@/domain/shared/venues";

export function UpcomingGameModal({ game, onClose }: any) {
  const { label, tier } = getCountdownInfo(game.scheduledFor);
  const gameTime = formatGameTime(game.scheduledFor);
  const venue = game.notes;
  const accentCls = tier === "today" ? "text-ak-gold" : tier === "week" ? "text-ak-red-text" : "text-ak-text-sub";

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div
        className="bg-ak-surface rounded-2xl p-6 max-w-[360px] w-full border border-ak-border2 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-black tracking-[0.18em] uppercase mb-1.5 ${accentCls}`}>
              {tier === "today" ? "⚡ Today" : "Upcoming"}
            </div>
            <div className="text-xl font-black text-ak-text leading-tight">
              {game.location === "home" ? "vs" : "@"} {game.opponent}
            </div>
            {game.competition && (
              <div className="text-xs text-ak-text-dim mt-1">{game.competition}</div>
            )}
          </div>
          <button onClick={onClose} className="bg-transparent border-0 text-ak-text-dim text-2xl cursor-pointer font-black pl-3 leading-none">×</button>
        </div>

        <div className="flex flex-col gap-1.5 mb-5">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-bold ${accentCls}`}>{label}</span>
            <span className="text-[13px] font-bold text-ak-text-sub">· {gameTime}</span>
          </div>
          {venue && (
            <a href={getVenueUrl(venue)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ak-text-sub no-underline">
              📍 {venue}
            </a>
          )}
        </div>

        <div className="flex gap-2">
          <a
            href={buildGoogleCalendarUrl(game.opponent, game.scheduledFor, venue)}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-[10px] px-3 rounded-lg border border-[#4285F440] bg-[#4285F410] text-[#4285F4] text-xs font-bold no-underline"
          >
            <GoogleCalIcon /> Google
          </a>
          <button
            onClick={() => downloadIcsFile(game.opponent, game.scheduledFor, venue)}
            className="flex-1 flex items-center justify-center gap-1.5 py-[10px] px-3 rounded-lg border border-ak-border2 bg-ak-base text-ak-text-sub text-xs font-bold cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            .ics
          </button>
        </div>
      </div>
    </div>
  );
}
