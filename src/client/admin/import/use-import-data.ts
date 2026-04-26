import { useState, useEffect } from "react";
import type { Player, SeasonLeague, ScheduledGame } from "@/client/admin";

export function useImportData(authed: boolean) {
  const [players,       setPlayers]       = useState<Player[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [schedule,      setSchedule]      = useState<ScheduledGame[]>([]);
  const [dataLoading,   setDataLoading]   = useState(false);

  const loadBase = async () => {
    setDataLoading(true);
    try {
      const [pRes, slRes, schRes] = await Promise.all([
        fetch("/api/admin/players"),
        fetch("/api/admin/season-leagues"),
        fetch("/api/admin/schedule"),
      ]);
      if (pRes.ok)   { const d = await pRes.json();   setPlayers(d.players ?? []); }
      if (slRes.ok)  { const d = await slRes.json();  setSeasonLeagues(d.seasonLeagues ?? []); }
      if (schRes.ok) { const d = await schRes.json(); setSchedule(d.schedule ?? []); }
    } finally { setDataLoading(false); }
  };

  useEffect(() => { if (authed) loadBase(); }, [authed]);

  return { players, seasonLeagues, schedule, setSchedule, dataLoading };
}
