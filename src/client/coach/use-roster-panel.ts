import { useState } from "react";
import { coachFetch } from "./csrf";

interface UseRosterPanelOpts {
  allPlayers:        any[];
  showToast:         (msg: string, type?: string) => void;
  onMarkAnnounced:   (gameId: string) => void;
  onUnmarkAnnounced: (gameId: string) => void;
}

export function useRosterPanel({ allPlayers, showToast, onMarkAnnounced, onUnmarkAnnounced }: UseRosterPanelOpts) {
  const [panelGameId,  setPanelGameId]  = useState<string | null>(null);
  const [rosterSlots,  setRosterSlots]  = useState<Record<string, { checked: boolean; note: string }>>({});
  const [rosterMsg,    setRosterMsg]    = useState("");
  const [panelLoading, setPanelLoading] = useState(false);
  const [saving,       setSaving]       = useState(false);

  const openPanel = async (g: any) => {
    const slots: Record<string, { checked: boolean; note: string }> = {};
    allPlayers.forEach(p => { slots[p.id] = { checked: false, note: "" }; });
    setRosterSlots(slots);
    setRosterMsg("");
    setPanelGameId(g.id);
    setPanelLoading(true);

    try {
      const res = await fetch(`/api/coach/roster-announcement?upcomingGameId=${g.id}`);
      if (res.ok) {
        const { announcement } = await res.json();
        if (announcement) {
          setRosterMsg(announcement.message ?? "");
          const updated = { ...slots };
          announcement.players.forEach((sp: any) => {
            if (updated[sp.playerId] !== undefined) {
              updated[sp.playerId] = { checked: true, note: sp.note ?? "" };
            }
          });
          setRosterSlots(updated);
        }
      }
    } finally {
      setPanelLoading(false);
    }
  };

  const closePanel = () => {
    setPanelGameId(null);
    setRosterSlots({});
    setRosterMsg("");
  };

  const togglePlayer = (pid: string) => {
    // eslint-disable-next-line security/detect-object-injection
    setRosterSlots(prev => ({ ...prev, [pid]: { ...prev[pid], checked: !prev[pid].checked } }));
  };

  const setNote = (pid: string, note: string) => {
    // eslint-disable-next-line security/detect-object-injection
    setRosterSlots(prev => ({ ...prev, [pid]: { ...prev[pid], note } }));
  };

  const publish = async () => {
    const players = Object.entries(rosterSlots)
      .filter(([, v]) => v.checked)
      .map(([playerId, v]) => ({ playerId, note: v.note || null }));

    if (players.length === 0) { showToast("Select at least one player.", "error"); return; }

    setSaving(true);
    try {
      const res = await coachFetch("/api/coach/roster-announcement", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ upcomingGameId: panelGameId, message: rosterMsg || null, players }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
      onMarkAnnounced(panelGameId!);
      showToast("Roster published!");
      closePanel();
    } finally { setSaving(false); }
  };

  const resendEmail = async () => {
    setSaving(true);
    try {
      const res = await coachFetch("/api/coach/roster-announcement", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ upcomingGameId: panelGameId, resend: true }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
      showToast("Email resent to all subscribers!");
    } finally { setSaving(false); }
  };

  const removeAnnouncement = async () => {
    setSaving(true);
    try {
      const res = await coachFetch("/api/coach/roster-announcement", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ upcomingGameId: panelGameId }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error, "error"); return; }
      onUnmarkAnnounced(panelGameId!);
      showToast("Roster announcement removed.");
      closePanel();
    } finally { setSaving(false); }
  };

  const selectedCount = Object.values(rosterSlots).filter(v => v.checked).length;

  return {
    panelGameId, rosterSlots, rosterMsg, panelLoading, saving, selectedCount,
    openPanel, closePanel, togglePlayer, setNote, setRosterMsg,
    publish, resendEmail, removeAnnouncement,
  };
}
