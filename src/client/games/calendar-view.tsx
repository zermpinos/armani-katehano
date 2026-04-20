import { useState, useMemo } from "react";
import { getCountdownInfo, formatGameTime } from "@/client/home/calendar-utils";
import { UpcomingGameModal } from "./upcoming-game-modal";

const CAL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function CalendarView({ games, upcomingGames, onGameClick, loadingBoxScore }: any) {
  const [selectedUpcoming, setSelectedUpcoming] = useState<any>(null);

  const months = useMemo(() => {
    const keys = new Set<string>();
    games.forEach((g: any) => {
      const [yr, mo] = g.date.split("-");
      keys.add(`${yr}-${mo}`);
    });
    return [...keys].sort();
  }, [games]);

  const initialKey = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 7);
    return months.find(k => k >= todayKey) || months[months.length - 1] || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once -- avoids resetting when filters change

  const [activeKey, setActiveKey] = useState(initialKey);

  if (months.length === 0) return null;

  const safeKey = months.includes(activeKey) ? activeKey : months[months.length - 1];
  const safeIdx = months.indexOf(safeKey);
  const [yr, mo] = safeKey.split("-").map(Number);
  const monthLabel = new Date(yr, mo - 1).toLocaleString("default", { month: "long" });
  const firstDow = (new Date(yr, mo - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(yr, mo, 0).getDate();

  const dayMap = new Map<number, any>();
  games.forEach((g: any) => {
    const [gYr, gMo, gDay] = g.date.split("-").map(Number);
    if (gYr === yr && gMo === mo) dayMap.set(gDay, g);
  });

  const upcomingDayMap = new Map<number, any>();
  (upcomingGames || []).forEach((g: any) => {
    const [gYr, gMo, gDay] = g.scheduledFor.slice(0, 10).split("-").map(Number);
    if (gYr === yr && gMo === mo) upcomingDayMap.set(gDay, g);
  });

  const cells: Array<{ type: "empty"; id: string } | { type: "day"; day: number }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ type: "empty", id: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: "day", day: d });

  const canPrev = safeIdx > 0;
  const canNext = safeIdx < months.length - 1;

  const navBtn = (disabled: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-[14px] py-[6px] rounded-lg bg-transparent border transition-all duration-150 text-base font-black leading-none ${
        disabled
          ? "border-ak-border text-ak-text-dim cursor-default opacity-30"
          : "border-ak-border2 text-ak-text cursor-pointer"
      }`}
    >{label}</button>
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          {navBtn(!canPrev, () => setActiveKey(months[safeIdx - 1]), "‹")}
          <div className="text-[13px] font-black text-ak-text tracking-[0.14em] uppercase text-center">
            {monthLabel} {yr}
          </div>
          {navBtn(!canNext, () => setActiveKey(months[safeIdx + 1]), "›")}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {CAL_DAYS.map(d => (
            <div key={d} className="text-center text-[9px] font-black text-ak-text-dim tracking-[0.08em] py-[3px]">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map(cell => {
            if (cell.type === "empty") return <div key={cell.id} className="aspect-square" />;
            const { day } = cell;
            const played = dayMap.get(day);
            const upcoming = upcomingDayMap.get(day);

            if (played) {
              const isWin = played.result === "W";
              return (
                <button
                  key={day}
                  onClick={!loadingBoxScore ? () => onGameClick(played) : undefined}
                  disabled={loadingBoxScore}
                  className={`aspect-square rounded-lg cursor-pointer flex flex-col items-center justify-center p-[3px_2px] gap-0.5 transition-[border-color,background] duration-150 min-w-0 overflow-hidden ${
                    isWin
                      ? "border border-[#4caf7d55] bg-[#4caf7d28] hover:border-ak-green hover:bg-[#4caf7d40]"
                      : "border border-[#e0555545] bg-[#8b1a1a38] hover:border-ak-red-text hover:bg-[#8b1a1a50]"
                  }`}
                >
                  <span className="text-[10px] font-black text-ak-text leading-none">{day}</span>
                  <span className={`text-[8px] font-bold leading-none tracking-[0.04em] ${isWin ? "text-ak-green" : "text-ak-red-text"}`}>{played.home ? "vs" : "@"}</span>
                  <span className="text-[8px] font-black text-ak-text leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-[3px]">{played.opponent}</span>
                </button>
              );
            }

            if (upcoming) {
              const { tier } = getCountdownInfo(upcoming.scheduledFor);
              const isToday = tier === "today";
              return (
                <button
                  key={day}
                  onClick={() => setSelectedUpcoming(upcoming)}
                  className={`aspect-square rounded-lg cursor-pointer flex flex-col items-center justify-center p-[3px_2px] gap-0.5 transition-[border-color,background] duration-150 min-w-0 overflow-hidden hover:border-ak-gold hover:bg-[#c9a84c28] ${
                    isToday
                      ? "border border-[#c9a84c70] bg-[#c9a84c18]"
                      : "border border-[#c9a84c40] bg-[#c9a84c0d]"
                  }`}
                >
                  <span className="text-[10px] font-black text-ak-gold leading-none">{day}</span>
                  <span className="text-[8px] font-bold text-ak-gold leading-none tracking-[0.04em]">{upcoming.location === "home" ? "vs" : "@"}</span>
                  <span className="text-[8px] font-black text-ak-text-sub leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-[3px]">{upcoming.opponent}</span>
                  <span className="text-[7px] text-ak-text-dim leading-none">{formatGameTime(upcoming.scheduledFor)}</span>
                </button>
              );
            }

            return (
              <div key={day} className="aspect-square rounded-lg border border-ak-border bg-ak-surface flex items-center justify-center">
                <span className="text-[10px] font-normal text-ak-text-dim leading-none">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedUpcoming && (
        <UpcomingGameModal game={selectedUpcoming} onClose={() => setSelectedUpcoming(null)} />
      )}
    </>
  );
}
