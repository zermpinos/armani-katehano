import { useState, useEffect } from "react";

export function useCoachSchedule(authed: boolean) {
  const [schedule,         setSchedule]        = useState<any[]>([]);
  const [allPlayers,       setAllPlayers]       = useState<any[]>([]);
  const [loadingData,      setLoadingData]      = useState(false);
  const [announcedGameIds, setAnnouncedGameIds] = useState<Set<string>>(new Set());

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
    setLoadingData(true);
    try {
      const res = await fetch("/api/coach/schedule");
      if (res.ok) {
        const d = await res.json();
        const games = d.schedule ?? [];
        setSchedule(games);
        loadAnnouncementBadges(games);
      }
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (authed) {
      loadData();
      loadPlayers();
    }
    // loadData and loadPlayers only call state setters and fetch -- no reactive deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const markAnnounced = (gameId: string) =>
    setAnnouncedGameIds(prev => new Set([...prev, gameId]));

  const unmarkAnnounced = (gameId: string) =>
    setAnnouncedGameIds(prev => { const s = new Set(prev); s.delete(gameId); return s; });

  return { schedule, allPlayers, loadingData, announcedGameIds, markAnnounced, unmarkAnnounced };
}
