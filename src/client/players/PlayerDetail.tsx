import Image from "next/image";
import { SeasonAverages } from "./SeasonAverages";
import { SeasonHistoryTable } from "./SeasonHistoryTable";
import { SkillRadar } from "./SkillRadar";
import { GameLogPanel } from "./GameLogPanel";

const playerImg = (player: any) => player.photoUrl || null;

export function PlayerDetail({ player, onClose, activeSeason }: any) {
  const s = player.stats;
  const gameLog = player.gameLog || [];
  const hasStats = s.gp > 0;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto pt-[80px] pb-8 px-4 bg-[rgba(10,10,10,0.88)] backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div
        className="max-w-[680px] mx-auto rounded-2xl overflow-hidden border border-ak-border2 bg-ak-surface"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 flex gap-5 items-center bg-ak-base border-b border-ak-border">
          <div className="w-[72px] h-[72px] rounded-[14px] overflow-hidden shrink-0 bg-ak-surface border border-ak-border2 flex items-center justify-center text-[32px] relative">
            {playerImg(player)
              ? <Image src={playerImg(player)} alt={player.name} fill className="object-cover object-top" />
              : "🏀"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[22px] font-black text-ak-text">{player.name}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-[11px] font-black tracking-[0.12em] rounded-full py-[3px] px-3 text-ak-red-text bg-[#8b1a1a20] border border-[#c0392b40]">
                #{player.number}
              </span>
              <span className="text-[11px] font-bold text-ak-text-sub">{player.position}</span>
              {player.height && <span className="text-[11px] text-ak-text-dim">{player.height}</span>}
              {player.age && <span className="text-[11px] text-ak-text-dim">Age {player.age}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[28px] font-black text-ak-text-dim bg-transparent border-0 cursor-pointer self-start"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {hasStats && <SeasonAverages s={s} />}

          <SeasonHistoryTable player={player} activeSeason={activeSeason} />

          {hasStats && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              <SkillRadar s={s} />
              {gameLog.length > 0 && <GameLogPanel gameLog={gameLog} />}
            </div>
          )}

          {!hasStats && (
            <div className="text-center py-6 text-ak-text-dim">
              <div className="text-[13px]">No stats recorded yet for this player.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
