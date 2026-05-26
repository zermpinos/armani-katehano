import Image from "next/image";
import { fmt } from "@/domain/players/format";

interface PlayerHeroProps {
  player: {
    name: string;
    number: string;
    position: string;
    height?: string | null;
    weight?: string | null;
    photoUrl?: string | null;
  };
  stats: {
    ppg: number;
    rpg: number;
    apg: number;
    eff: number;
    gp: number;
  };
}

export function PlayerHero({ player, stats }: PlayerHeroProps) {
  const hasStats = stats.gp > 0;
  const statRow: [string, string | number][] = [
    ["PPG", hasStats ? stats.ppg : "—"],
    ["RPG", hasStats ? stats.rpg : "—"],
    ["APG", hasStats ? stats.apg : "—"],
    ["EFF", hasStats ? stats.eff : "—"],
  ];

  return (
    <div className="flex gap-5 mb-6 p-5 rounded-2xl bg-ak-surface border border-ak-border">
      <div className="relative w-[100px] shrink-0">
        <div className="w-[100px] h-[100px] rounded-[14px] overflow-hidden bg-ak-base border border-ak-border2 flex items-center justify-center text-[40px] relative">
          {player.photoUrl
            ? <Image src={player.photoUrl} alt={player.name} fill className="object-cover object-top" />
            : <span>🏀</span>}
        </div>
        <div className="absolute top-[6px] right-[6px] w-[24px] h-[24px] rounded-md flex items-center justify-center text-[11px] font-black bg-ak-red text-ak-text z-[2]">
          {player.number}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[24px] font-black text-ak-text leading-tight">{fmt(player.name)}</div>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-[11px] font-black tracking-[0.12em] rounded-full py-[3px] px-3 text-ak-red-text bg-[#8b1a1a20] border border-[#c0392b40]">
            {player.position}
          </span>
          {player.height && <span className="text-[11px] text-ak-text-dim">{player.height}</span>}
          {player.weight && <span className="text-[11px] text-ak-text-dim">{player.weight}</span>}
        </div>
        <div className="mt-4 flex gap-6">
          {statRow.map(([label, value]) => (
            <div key={label} className="text-center">
              <div className="text-[10px] font-black tracking-[0.12em] text-ak-text-dim">{label}</div>
              <div className={`text-[18px] font-black mt-0.5 ${label === "EFF" ? "text-ak-gold" : "text-ak-text"}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
