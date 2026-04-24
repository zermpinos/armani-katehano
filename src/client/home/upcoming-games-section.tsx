import { getCountdownInfo, formatGameTime, downloadIcsFile, buildGoogleCalendarUrl } from "./calendar-utils";
import { GoogleCalIcon } from "./google-cal-icon";
import { RosterPanel } from "./roster-panel";
import { ShowMoreButton } from "./show-more-button";
import { getVenueUrl } from "@/domain/shared/venues";

interface Props {
  upcomingGames: any[];
  openRosterId: string | null;
  onToggleRoster: (id: string) => void;
  onPlayerClick: (id: string) => void;
  showAllUpcoming: boolean;
  onShowMore: () => void;
}

export function UpcomingGamesSection({ upcomingGames, openRosterId, onToggleRoster, onPlayerClick, showAllUpcoming, onShowMore }: Props) {
  if (!upcomingGames?.length) return null;

  const featured = upcomingGames[0];
  const rest = upcomingGames.slice(1);
  const { label: featLabel, tier: featTier } = getCountdownInfo(featured.scheduledFor);
  const featTime = formatGameTime(featured.scheduledFor);
  const isToday = featTier === "today";
  const isWeek  = featTier === "week";
  const featAccentCls = isToday ? "text-ak-gold" : isWeek ? "text-ak-red-text" : "text-ak-text-sub";
  const featVenue = featured.notes;

  return (
    <div className="rounded-2xl py-5 px-4 border border-ak-border bg-ak-surface mb-6 shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
      <div className="mb-[14px]">
        <div className="text-[11px] font-black tracking-[0.18em] text-ak-text-dim uppercase">Schedule</div>
        <h2 className="text-[clamp(16px,5vw,18px)] font-bold text-ak-text mt-1 mb-0">Upcoming Games</h2>
      </div>

      {/* Featured card: next game */}
      <div className={`rounded-[14px] py-[18px] px-5 border ${
        isToday ? "border-[#c9a84c55] bg-[#c9a84c0d] shadow-[0_8px_24px_#c9a84c18]"
        : isWeek ? "border-[#e0555535] bg-[#e055550a] shadow-[0_4px_16px_#e0555512]"
        : "border-ak-border2 bg-ak-surface2 shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
      } ${rest.length > 0 ? "mb-[10px]" : ""}`}>
        <div className={`text-[10px] font-black tracking-[0.18em] uppercase mb-3 ${isToday ? "text-ak-gold" : "text-ak-red-text"}`}>
          {isToday ? "⚡ Today" : "Next Game"}
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <div className="text-[clamp(18px,5vw,24px)] font-black text-ak-text leading-[1.15]">
                {featured.location === "home" ? "vs" : "@"} {featured.opponent}
              </div>
              <div className={`text-[clamp(13px,3vw,15px)] font-bold ${featAccentCls}`}>{featTime}</div>
            </div>
            {featured.competition && (
              <div className="text-xs text-ak-text-dim font-medium mb-1">{featured.competition}</div>
            )}
            {featVenue && (
              <a
                href={getVenueUrl(featVenue)}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-ak-text-sub no-underline transition-colors duration-200 mt-0.5 hover:text-ak-red-text"
              >
                📍 {featVenue}
              </a>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={`text-[11px] font-bold ${featAccentCls} py-[3px] px-[10px] rounded-full whitespace-nowrap ${
              isToday ? "bg-[#c9a84c20]" : isWeek ? "bg-[#e0555512]" : "bg-[#a8a8ac10]"
            } tracking-[0.03em]`}>
              {featLabel}
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={buildGoogleCalendarUrl(featured.opponent, featured.scheduledFor, featVenue)}
                target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                aria-label={`Add ${featured.location === "home" ? "vs" : "@"} ${featured.opponent} to Google Calendar`}
                className="inline-flex items-center gap-1.5 py-[7px] px-3 rounded-lg border border-[#4285F440] bg-[#4285F410] text-[#4285F4] text-[11px] font-bold no-underline cursor-pointer whitespace-nowrap transition-all duration-200 hover:bg-[#4285F420] hover:border-[#4285F465]"
              >
                <GoogleCalIcon />
                Google
              </a>
              <button
                onClick={e => { e.stopPropagation(); downloadIcsFile(featured.opponent, featured.scheduledFor, featVenue); }}
                className="inline-flex items-center gap-1.5 py-[7px] px-3 rounded-lg border border-ak-border2 bg-ak-base text-ak-text-sub text-[11px] font-bold cursor-pointer whitespace-nowrap transition-all duration-200 hover:text-ak-text"
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

        <div className="mt-3 pt-[10px] border-t border-ak-border">
          {featured.announcement ? (
            <>
              <button
                onClick={() => onToggleRoster(featured.id)}
                className="bg-transparent border-0 text-[11px] font-bold text-ak-text-dim cursor-pointer tracking-[0.1em] uppercase py-0.5 px-0 flex items-center gap-1.5 hover:text-ak-text-sub transition-colors duration-150"
              >
                {openRosterId === featured.id
                  ? "Hide Roster ↑"
                  : `View Roster (${featured.announcement.players.length} players) →`}
              </button>
              {openRosterId === featured.id && <RosterPanel announcement={featured.announcement} onPlayerClick={onPlayerClick} />}
            </>
          ) : (
            <div className="text-[11px] text-ak-text-dim tracking-[0.04em]">Roster TBA</div>
          )}
        </div>
      </div>

      {/* Compact cards: remaining games */}
      {rest.length > 0 && (
        <div className="flex flex-col gap-[5px]">
          {(showAllUpcoming ? rest : rest.slice(0, 3)).map((g: any) => {
            const { label, tier } = getCountdownInfo(g.scheduledFor);
            const gameTime = formatGameTime(g.scheduledFor);
            const accentCls = tier === "today" ? "text-ak-gold" : tier === "week" ? "text-ak-red-text" : "text-ak-text-sub";
            const venue = g.notes;
            const rosterOpen = openRosterId === g.id;
            return (
              <div key={g.id}>
                <div className={`flex items-center justify-between gap-[10px] py-[10px] px-[14px] border bg-transparent transition-all duration-150 hover:bg-ak-surface2 ${
                  rosterOpen ? "rounded-t-[10px] border-[#4caf7d40]" : "rounded-[10px] border-ak-border"
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[13px] font-bold text-ak-text">
                        {g.location === "home" ? "vs" : "@"} {g.opponent}
                      </span>
                      <span className={`text-[11px] font-semibold ${accentCls}`}>{gameTime}</span>
                      {g.competition && <span className="text-[11px] text-ak-text-dim">· {g.competition}</span>}
                    </div>
                    <div className="text-[11px] text-ak-text-dim mt-0.5">{label}</div>
                  </div>
                  <div className="flex items-center gap-[5px] shrink-0">
                    <a
                      href={buildGoogleCalendarUrl(g.opponent, g.scheduledFor, venue)}
                      target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      aria-label={`Add ${g.location === "home" ? "vs" : "@"} ${g.opponent} to Google Calendar`}
                      className="flex items-center justify-center w-7 h-7 rounded-[7px] border border-ak-border bg-ak-base no-underline transition-all duration-150 hover:border-[#4285F4] hover:bg-[#4285F412]"
                    >
                      <GoogleCalIcon />
                    </a>
                    <button
                      onClick={e => { e.stopPropagation(); downloadIcsFile(g.opponent, g.scheduledFor, venue); }}
                      title="Download .ics"
                      className="flex items-center justify-center w-7 h-7 rounded-[7px] border border-ak-border bg-ak-base text-ak-text-dim cursor-pointer transition-all duration-150 hover:border-ak-border2 hover:text-ak-text-sub"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onToggleRoster(g.id); }}
                      title={g.announcement ? (rosterOpen ? "Hide roster" : "View roster") : "Roster TBA"}
                      disabled={!g.announcement}
                      className={`flex items-center justify-center w-7 h-7 rounded-[7px] border text-[10px] font-black tracking-[0.05em] transition-all duration-150 ${
                        rosterOpen
                          ? "border-[#4caf7d60] bg-[#4caf7d15] text-ak-green cursor-pointer"
                          : g.announcement
                            ? "border-ak-border bg-ak-base text-ak-text-dim cursor-pointer hover:border-ak-border2 hover:text-ak-text-sub"
                            : "border-ak-border bg-ak-base text-ak-text-dim cursor-default opacity-40"
                      }`}
                    >
                      {g.announcement ? (rosterOpen ? "↑" : `${g.announcement.players.length}`) : "—"}
                    </button>
                  </div>
                </div>
                {rosterOpen && g.announcement && (
                  <div className="py-[10px] px-[14px] pb-3 border border-[#4caf7d40] border-t-0 rounded-b-[10px] bg-[#4caf7d05]">
                    <RosterPanel announcement={g.announcement} onPlayerClick={onPlayerClick} />
                  </div>
                )}
              </div>
            );
          })}

          {!showAllUpcoming && rest.length > 3 && (
            <div className="text-center pt-1">
              <ShowMoreButton onClick={onShowMore}>
                {rest.length - 3} more game{rest.length - 3 !== 1 ? "s" : ""} →
              </ShowMoreButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
