import { BoxScoreTable, F, Sel, Btn } from "@/client/admin";
import type { Player, SeasonLeague } from "@/client/admin";
import { teamRatingsFromBox } from "@/domain/stats";
import type { ImportDraft } from "@/domain/import/resolve";
import type { GateResult } from "@/domain/import/verify";

type Props = {
  draft: ImportDraft;
  phase: string;
  gameState: { state: string; reason: string } | null;
  gate: GateResult | null;
  unresolved: string[];
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  players: Player[];
  highlights: Record<string, boolean>;
  seasonLeagues: SeasonLeague[];
  updDraft: (k: string, v: unknown) => void;
  updBox: (playerId: string, k: string, v: string) => void;
  onSave: () => void;
  onBack: () => void;
};

const urlInputCls = "w-full py-[10px] px-3 text-[13px] font-sans rounded-lg border border-ak-border2 bg-ak-base text-ak-text outline-none";

export function ReviewForm({
  draft, phase, gameState, gate, unresolved,
  youtubeUrl, setYoutubeUrl, players, highlights, seasonLeagues,
  updDraft, updBox, onSave, onBack,
}: Props) {
  const leagueMissing = !draft.seasonLeagueId;
  // The state check has its own banner above.
  const gateFailures = (gate?.failures ?? []).filter(f => f.check !== "state");

  // Derived from the box currently in the form, so edits move the ratings.
  const rtg = teamRatingsFromBox(
    draft.boxScore,
    Number(draft.teamScore) || 0,
    Number(draft.opponentScore) || 0,
  );
  const leagueOptions = [
    ...(leagueMissing ? [{ value: "", label: "Select a league" }] : []),
    ...seasonLeagues.map(sl => ({ value: sl.id, label: sl.leagueName })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {gameState && gameState.state !== "final" && (
        <div className={[
          "py-[10px] px-[14px] rounded-lg text-xs border",
          gameState.state === "scheduled"
            ? "bg-[#8b1a1a18] border-[#8b1a1a40] text-ak-red-text"
            : "bg-[#8b5a0018] border-[#8b5a0040] text-[#b8860b]",
        ].join(" ")}>
          <div className="font-black mb-0.5">
            {gameState.state === "scheduled" ? "Game not yet played" : "Game may still be in progress"}
          </div>
          <div>{gameState.reason}</div>
        </div>
      )}

      {(unresolved.length > 0 || leagueMissing) && (
        <div className="py-[10px] px-[14px] rounded-lg bg-[#8b1a1a30] border border-[#8b1a1a] text-xs text-ak-red-text">
          <div className="font-black mb-1">Blocked - fix before saving:</div>
          {unresolved.map((u, i) => <div key={i}>• {u}</div>)}
          {leagueMissing && <div>• No league matched the source URL. Pick one under Game info.</div>}
        </div>
      )}

      {gateFailures.length > 0 && (
        <div className="py-[10px] px-[14px] rounded-lg bg-[#8b1a1a18] border border-[#8b1a1a40] text-xs text-ak-red-text">
          <div className="font-black mb-1">⚠ Source data failed verification - check these before saving:</div>
          {gateFailures.map((f, i) => <div key={i}>• {f.detail}</div>)}
        </div>
      )}

      <div>
        <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[10px] uppercase">Game info</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-[10px]">
          <F label="DATE"       value={draft.date}          onChange={v => updDraft("date", v)}          placeholder="YYYY-MM-DD" />
          <F label="OPPONENT"   value={draft.opponent}      onChange={v => updDraft("opponent", v)} />
          <Sel label="LEAGUE"   value={draft.seasonLeagueId || ""} onChange={v => updDraft("seasonLeagueId", v)} options={leagueOptions} />
          <Sel label="HOME/AWAY" value={draft.home ? "home" : "away"} onChange={v => updDraft("home", v === "home")} options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }]} />
          <Sel label="RESULT"   value={draft.result}        onChange={v => updDraft("result", v)}        options={[{ value: "W", label: "Win" }, { value: "L", label: "Loss" }, { value: "T", label: "Tie" }]} />
          <F label="OUR SCORE"  value={draft.teamScore}     onChange={v => updDraft("teamScore", v)}     type="number" />
          <F label="OPP SCORE"  value={draft.opponentScore} onChange={v => updDraft("opponentScore", v)} type="number" />
        </div>
      </div>

      <div>
        <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[6px] uppercase">
          YouTube video URL <span className="font-normal normal-case text-[11px]">(optional)</span>
        </div>
        <input
          type="url"
          value={youtubeUrl}
          onChange={e => setYoutubeUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className={urlInputCls}
        />
      </div>

      <div>
        <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[8px] uppercase">
          Team ratings (derived from this box score)
        </div>
        <div className="flex gap-[10px]">
          <div className="flex-1 py-[10px] px-[12px] rounded-lg border border-ak-border bg-ak-surface2 text-center">
            <div className="text-[9px] font-black tracking-[0.12em] text-ak-text-dim mb-[4px]">OFF RTG</div>
            <div className="text-[18px] font-black text-ak-text">{rtg ? rtg.offRating.toFixed(1) : "-"}</div>
          </div>
          <div className="flex-1 py-[10px] px-[12px] rounded-lg border border-ak-border bg-ak-surface2 text-center">
            <div className="text-[9px] font-black tracking-[0.12em] text-ak-text-dim mb-[4px]">DEF RTG</div>
            <div className="text-[18px] font-black text-ak-text">{rtg ? rtg.defRating.toFixed(1) : "-"}</div>
          </div>
        </div>
        <div className="text-[10px] text-ak-text-dim mt-[6px]">
          Points per 100 possessions, poss = 0.96 * (FGA - OREB + TOV + 0.44 * FTA).
          {!rtg && " Shown once the per-player points match our score."}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[10px] uppercase">Box score - green rows played</div>
        <BoxScoreTable players={players} rows={draft.boxScore} onUpdate={updBox} highlights={highlights} />
      </div>

      <div className="flex gap-[10px] pt-1">
        <Btn
          onClick={onSave}
          variant="green"
          disabled={phase === "saving" || gameState?.state === "scheduled" || unresolved.length > 0 || leagueMissing}
        >
          {phase === "saving" ? "SAVING..." : "SAVE GAME"}
        </Btn>
        <Btn variant="ghost" onClick={onBack} disabled={phase === "saving"}>BACK</Btn>
      </div>
    </div>
  );
}
