import { Btn, F, ListRow, Spinner } from "@/client/admin";
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

export function IdleForm({ schedule, gameUrl, setGameUrl, youtubeUrl, setYoutubeUrl, fetching, error, onFetch }: Props) {
  const now = new Date();
  const candidates = schedule
    .filter(g => g.sourceUrl && new Date(g.scheduledFor) <= now)
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());

  return (
    <div className="flex flex-col gap-[14px]">
      {candidates.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">Not imported yet</div>
          <ul className="flex flex-col gap-2">
            {candidates.map(g => (
              <li key={g.id}>
                <ListRow onClick={() => { if (!fetching) onFetch(g.sourceUrl!); }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ak-text-dim">{g.location === "home" ? "vs" : "@"}</span>
                    <span className="truncate text-[15px] font-black text-ak-text">{g.opponent}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-ak-text-dim">{fmtDate(g.scheduledFor)}{g.competition ? ` · ${g.competition}` : ""}</div>
                </ListRow>
              </li>
            ))}
          </ul>
        </div>
      )}

      <F label="GAME URL" type="url" value={gameUrl} onChange={setGameUrl} placeholder="https://basketcity.sportstats.gr/men/gamedetails/id/..." />
      <F label="YOUTUBE VIDEO URL (OPTIONAL)" type="url" value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://www.youtube.com/watch?v=..." />

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
