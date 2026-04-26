export function SeasonHistoryTable({ player, activeSeason }: any) {
  if (
    activeSeason !== "all-time" ||
    !player.seasonHistory ||
    Object.keys(player.seasonHistory).length <= 1
  ) return null;

  return (
    <div className="mb-6">
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">
        Season by Season
      </div>
      <div className="rounded-[10px] border border-ak-border overflow-hidden">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-ak-base">
              {["Season","GP","PPG","RPG","APG","FG%","EFF"].map(h => (
                <th
                  key={h}
                  className={[
                    "py-[6px] px-[10px] font-black tracking-[0.1em] text-ak-text-dim border-b border-ak-border",
                    h === "Season" ? "text-left" : "text-center",
                  ].join(" ")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(player.seasonHistory as Record<string, any>)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([sid, ss], i) => (
                <tr key={sid} className={i % 2 === 0 ? "bg-ak-surface" : "bg-ak-base"}>
                  <td className="py-[6px] px-[10px] font-bold text-ak-text-sub">{sid.replace(/-/g,"–")}</td>
                  <td className="py-[6px] px-[10px] text-center text-ak-text-dim">{ss.gp}</td>
                  <td className="py-[6px] px-[10px] text-center font-black text-ak-red-text">{ss.ppg}</td>
                  <td className="py-[6px] px-[10px] text-center text-ak-text">{ss.rpg}</td>
                  <td className="py-[6px] px-[10px] text-center text-ak-text">{ss.apg}</td>
                  <td className="py-[6px] px-[10px] text-center text-ak-text">{ss.fgPct > 0 ? `${ss.fgPct}%` : "—"}</td>
                  <td className="py-[6px] px-[10px] text-center font-black text-ak-gold">{ss.eff}</td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
