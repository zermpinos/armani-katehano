import { useState, useEffect } from "react";
import type { HeadToHead } from "@/domain/stats/head-to-head";

export function useCoachSchedule(authed: boolean) {
  const [schedule,         setSchedule]        = useState<any[]>([]);
  const [headToHead,       setHeadToHead]      = useState<HeadToHead[]>([]);
  const [allPlayers,       setAllPlayers]       = useState<any[]>([]);
  const [loadingData,      setLoadingData]      = useState(true);
  const [announcedGameIds, setAnnouncedGameIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authed) return;

    const loadPlayers = async () => {
      const res = await fetch("/api/coach/players");
      if (res.ok) {
        const d = await res.json();
        setAllPlayers(d.players ?? []);
      }
    };

    const loadAnnouncementBadges = async (games: any[]) => {
      if (games.length === 0) return;
      const results = await Promise.all(
        games.map(g =>
          fetch(`/api/coach/roster-announcement?upcomingGameId=${g.id}`)
            .then(r => r.json())
            .then(d => ({ id: g.id, has: !!d.announcement }))
            .catch(() => ({ id: g.id, has: false }))
        )
      );
      const ids = new Set(results.filter(r => r.has).map(r => r.id));
      setAnnouncedGameIds(ids);
    };

    const loadData = async () => {
      try {
        const res = await fetch("/api/coach/schedule");
        if (res.ok) {
          const d = await res.json();
          const games = d.schedule ?? [];
          setSchedule(games);
          setHeadToHead(d.headToHead ?? []);
          loadAnnouncementBadges(games);
        }
      } finally {
        setLoadingData(false);
      }
    };

    void loadData();
    void loadPlayers();
  }, [authed]);

  const markAnnounced = (gameId: string) =>
    setAnnouncedGameIds(prev => new Set([...prev, gameId]));

  const unmarkAnnounced = (gameId: string) =>
    setAnnouncedGameIds(prev => { const s = new Set(prev); s.delete(gameId); return s; });

  return { schedule, headToHead, allPlayers, loadingData, announcedGameIds, markAnnounced, unmarkAnnounced };
}
