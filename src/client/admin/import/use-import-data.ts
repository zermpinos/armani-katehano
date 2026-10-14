import { useState, useEffect } from "react";
import type { Player, SeasonLeague, ScheduledGame } from "@/client/admin";
import { apiFetch } from "@/client/admin/csrf";

export function useImportData() {
  const [players,       setPlayers]       = useState<Player[]>([]);
  const [seasonLeagues, setSeasonLeagues] = useState<SeasonLeague[]>([]);
  const [schedule,      setSchedule]      = useState<ScheduledGame[]>([]);
  const [dataLoading,   setDataLoading]   = useState(true);

  useEffect(() => {
    const loadBase = async () => {
      try {
        const [pRes, slRes, schRes] = await Promise.all([
          apiFetch("/api/admin/players"),
          apiFetch("/api/admin/season-leagues"),
          apiFetch("/api/admin/schedule"),
        ]);
        if (pRes.ok)   { const d = await pRes.json();   setPlayers(d.players ?? []); }
        if (slRes.ok)  { const d = await slRes.json();  setSeasonLeagues(d.seasonLeagues ?? []); }
        if (schRes.ok) { const d = await schRes.json(); setSchedule(d.schedule ?? []); }
      } finally { setDataLoading(false); }
    };
    void loadBase();
  }, []);

  return { players, setPlayers, seasonLeagues, schedule, setSchedule, dataLoading };
}
