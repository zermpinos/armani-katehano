import Link from "next/link";
import { StatTile } from "@/components/ui";
import { fmtDate } from "@/domain/shared/format";
import type { TeamRecord } from "@/domain/stats/records";

export function TeamRecordTiles({ records }: { records: TeamRecord[] }) {
  if (!records.length) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {records.map(r => {
        const sub = r.from
          ? `${fmtDate(r.from)} to ${fmtDate(r.to)}`
          : `${r.home ? "vs" : "@"} ${r.opponent} · ${fmtDate(r.date)}`;
        const tile = <StatTile label={r.label} value={r.value} sub={sub} highlight={r.key === "points"} />;

        // The streak spans games, so there is nothing single to link it to.
        return r.gameId
          ? (
            <Link
              key={r.key}
              href={`/games/${r.gameId}`}
              aria-label={`${r.label}, ${r.value}, ${sub}, open the box score`}
              className="no-underline"
            >
              {tile}
            </Link>
          )
          : <div key={r.key}>{tile}</div>;
      })}
    </div>
  );
}

export function SeasonBySeason({ rows }: { rows: { season: string; rec: any }[] }) {
  if (!rows.length) return null;

  return (
    <>
      <div className="text-[11px] font-black tracking-[0.15em] text-ak-text-dim mb-3 uppercase">
        Season by Season
      </div>
      <div className="rounded-[10px] border border-ak-border overflow-hidden mb-8">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-ak-base">
              {["Season", "GP", "W-L", "PPG", "OPP PPG"].map(h => (
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
            {rows.map(({ season, rec }) => (
              <tr key={season} className="border-b border-ak-border last:border-b-0">
                <td className="py-[6px] px-[10px] font-bold text-ak-text-sub">{season}</td>
                <td className="py-[6px] px-[10px] text-center text-ak-text-dim">{rec.gp}</td>
                <td className="py-[6px] px-[10px] text-center font-bold text-ak-text">{rec.wins}-{rec.losses}</td>
                <td className="py-[6px] px-[10px] text-center text-ak-text-sub">{rec.ppg}</td>
                <td className="py-[6px] px-[10px] text-center text-ak-text-sub">{rec.oppPpg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
