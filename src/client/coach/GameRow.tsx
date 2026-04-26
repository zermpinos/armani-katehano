import React from "react";
import { fmtDate } from "@/domain/shared/format";
import { Btn, Spinner } from "./primitives";
import { CoachRosterPanel } from "./roster-panel";

const fmtTime = (iso: string) => iso.slice(11, 16);

interface GameRowProps {
  game:                 any;
  panelGameId:          string | null;
  announcedGameIds:     Set<string>;
  onOpen:               (g: any) => void;
  onClose:              () => void;
  allPlayers:           any[];
  rosterSlots:          Record<string, { checked: boolean; note: string }>;
  rosterMsg:            string;
  onRosterMsgChange:    (msg: string) => void;
  panelLoading:         boolean;
  saving:               boolean;
  selectedCount:        number;
  onTogglePlayer:       (pid: string) => void;
  onSetNote:            (pid: string, note: string) => void;
  onPublish:            () => void;
  onResendEmail:        () => void;
  onRemoveAnnouncement: () => void;
}

export function GameRow({
  game, panelGameId, announcedGameIds,
  onOpen, onClose,
  allPlayers, rosterSlots, rosterMsg, onRosterMsgChange,
  panelLoading, saving, selectedCount,
  onTogglePlayer, onSetNote, onPublish, onResendEmail, onRemoveAnnouncement,
}: GameRowProps) {
  const isOpen      = panelGameId === game.id;
  const isAnnounced = announcedGameIds.has(game.id);

  return (
    <div>
      <div className={[
        "flex items-center justify-between flex-wrap gap-2 py-3 px-4 rounded-[10px] border transition-[border-color,background] duration-150",
        isOpen ? "border-[#4caf7d60] bg-[#4caf7d08]" : "border-ak-border bg-ak-surface2",
      ].join(" ")}>
        <div className="flex-1 min-w-[180px]">
          <div className="font-black text-[14px] text-ak-text flex items-center gap-2 flex-wrap">
            {game.location === "home" ? "vs" : "@"} {game.opponent}
            {isAnnounced && (
              <span className="text-[9px] font-black tracking-[0.1em] uppercase px-[7px] py-[2px] rounded bg-[#4caf7d20] text-ak-green border border-[#4caf7d40]">
                Roster set
              </span>
            )}
          </div>
          <div className="text-[11px] text-ak-text-dim mt-[3px]">
            {fmtDate(game.scheduledFor)} · {fmtTime(game.scheduledFor)}
            {game.competition && <> · {game.competition}</>}
          </div>
        </div>
        <Btn size="sm" variant={isOpen ? "ghost" : "primary"} onClick={() => isOpen ? onClose() : onOpen(game)}>
          {isOpen ? "CLOSE" : isAnnounced ? "EDIT ROSTER" : "SET ROSTER"}
        </Btn>
      </div>

      {isOpen && (
        <div className="mt-1 rounded-[10px] border border-[#4caf7d40] p-5 bg-ak-base">
          {panelLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <CoachRosterPanel
              allPlayers={allPlayers}
              rosterSlots={rosterSlots}
              rosterMsg={rosterMsg}
              onRosterMsgChange={onRosterMsgChange}
              panelLoading={panelLoading}
              saving={saving}
              selectedCount={selectedCount}
              isAnnounced={isAnnounced}
              onTogglePlayer={onTogglePlayer}
              onSetNote={onSetNote}
              onPublish={onPublish}
              onResendEmail={onResendEmail}
              onRemoveAnnouncement={onRemoveAnnouncement}
              onClose={onClose}
            />
          )}
        </div>
      )}
    </div>
  );
}
