import { fmt } from "@/domain/players/format";
import type { Player, BoxScoreRow } from "./shared";

const BOX_COLS = [
  { key: "min", label: "MIN" }, { key: "pts", label: "PTS" }, { key: "reb", label: "REB" },
  { key: "ast", label: "AST" }, { key: "stl", label: "STL" }, { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" }, { key: "fgm", label: "FGM" }, { key: "fga", label: "FGA" },
  { key: "fg2m", label: "2PM" }, { key: "fg2a", label: "2PA" },
  { key: "fg3m", label: "3PM" }, { key: "fg3a", label: "3PA" },
  { key: "ftm", label: "FTM" }, { key: "fta", label: "FTA" }, { key: "eff", label: "EFF" },
];

export function BoxScoreTable({ players, rows, onUpdate, highlights = {} }: {
  players: Player[];
  rows: BoxScoreRow[];
  onUpdate?: ((playerId: string, key: string, value: string) => void) | null;
  highlights?: Record<string, boolean>;
}) {
  if (!rows || rows.length === 0) return null;

  const playerMap = new Map(players.map(p => [p.id, p]));

  return (
    <div className="overflow-x-auto rounded-lg border border-ak-border">
      <table className="w-full border-collapse text-[11px] min-w-[900px]">
        <thead>
          <tr className="bg-ak-base">
            <th className="py-[7px] px-[10px] text-left text-[9px] font-black text-ak-text-dim tracking-[0.12em] whitespace-nowrap">#</th>
            <th className="py-[7px] px-[10px] text-left text-[9px] font-black text-ak-text-dim tracking-[0.12em] min-w-[130px]">PLAYER</th>
            {BOX_COLS.map(c => (
              <th key={c.key} className={[
                "py-[7px] px-[6px] text-[9px] font-black tracking-[0.1em] text-center min-w-[40px]",
                c.key === "eff" ? "text-ak-red-text" : "text-ak-text-dim",
              ].join(" ")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const player = playerMap.get(row.playerId);
            const played = highlights[row.playerId];
            const rowData = row as unknown as Record<string, number | undefined>;
            return (
              <tr key={row.playerId} className={[
                "border-t border-ak-border",
                played ? "bg-[#4caf7d10]" : i % 2 === 0 ? "bg-ak-surface" : "bg-ak-surface2",
              ].join(" ")}>
                <td className="py-[5px] px-[10px] text-ak-text-dim font-bold">{player?.number ?? "?"}</td>
                <td className={["py-[5px] px-[10px] text-[12px]", played ? "text-ak-green font-black" : "text-ak-text font-normal"].join(" ")}>
                  {player ? fmt(player.name) : "--"}
                </td>
                {BOX_COLS.map(c => (
                  <td key={c.key} className="py-[3px] px-1 text-center">
                    {onUpdate ? (
                      <input
                        type="number"
                        aria-label={`${c.label} for ${player ? fmt(player.name) : row.playerId}`}
                        value={rowData[c.key] ?? 0}
                        onChange={e => onUpdate(row.playerId, c.key, e.target.value)}
                        className={[
                          "w-[38px] text-center text-[11px] py-[2px] bg-transparent rounded border font-sans outline-none",
                          played ? "border-[#4caf7d40]" : "border-ak-border",
                          c.key === "eff" ? "text-ak-red-text" : "text-ak-text-sub",
                        ].join(" ")}
                      />
                    ) : (
                      <span className={c.key === "eff" ? "text-ak-red-text" : "text-ak-text-sub"}>{rowData[c.key] ?? 0}</span>
                    )}
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
