import { Btn, Spinner } from "@/client/admin";
import type { ScheduledGame } from "@/client/admin";
import { fmtDate } from "@/domain/shared/format";

type Props = {
  schedule: ScheduledGame[];
  gameUrl: string;
  setGameUrl: (v: string) => void;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  fetching: boolean;
  error: string;
  onFetch: (overrideUrl?: string) => void;
};

const urlInputCls = "w-full py-[10px] px-3 text-[13px] font-sans rounded-lg border border-ak-border2 bg-ak-base text-ak-text outline-none";

export function IdleForm({ schedule, gameUrl, setGameUrl, youtubeUrl, setYoutubeUrl, fetching, error, onFetch }: Props) {
  const now = new Date();
  const candidates = schedule
    .filter(g => g.sourceUrl && new Date(g.scheduledFor) <= now)
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());

  return (
    <div className="flex flex-col gap-[14px]">
      {candidates.length > 0 && (
        <div>
          <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[6px] uppercase">Quick import</div>
          <div className="flex flex-col gap-[4px]">
            {candidates.map(g => (
              <button
                key={g.id}
                type="button"
                disabled={fetching}
                onClick={() => onFetch(g.sourceUrl!)}
                className="w-full text-left py-[8px] px-[12px] rounded-lg border border-ak-border bg-ak-surface2 hover:border-ak-border2 text-[12px] text-ak-text disabled:opacity-50 transition-colors"
              >
                <span className="font-black">{g.location === "home" ? "vs" : "@"} {g.opponent}</span>
                <span className="text-ak-text-dim ml-2">{fmtDate(g.scheduledFor)}{g.competition ? ` · ${g.competition}` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-black tracking-[0.15em] text-ak-text-dim mb-[6px] uppercase">Game URL</div>
        <input
          type="url"
          value={gameUrl}
          onChange={e => setGameUrl(e.target.value)}
          placeholder="https://basketcity.sportstats.gr/men/gamedetails/id/..."
          disabled={fetching}
          className={urlInputCls}
        />
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
          disabled={fetching}
          className={urlInputCls}
        />
      </div>

      {error && (
        <div className="text-xs text-ak-red-text py-2 px-3 rounded-lg bg-[#8b1a1a18] border border-[#8b1a1a40]">{error}</div>
      )}

      <div>
        <Btn onClick={() => onFetch()} disabled={!gameUrl.trim() || fetching}>
          {fetching ? "FETCHING..." : "FETCH & REVIEW"}
        </Btn>
      </div>

      {fetching && (
        <div className="flex items-center gap-[10px] text-ak-text-dim text-xs">
          <Spinner /> Scraping game page...
        </div>
      )}
    </div>
  );
}
