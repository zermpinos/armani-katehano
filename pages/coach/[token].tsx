import React, { useState } from "react";
import Head from "next/head";
import { Spinner } from "@/client/coach/primitives";
import { LoginForm } from "@/client/coach/login-form";
import { ChangePasswordForm } from "@/client/coach/change-password-form";
import { GameRow } from "@/client/coach/GameRow";
import { useCoachAuth } from "@/client/coach/use-coach-auth";
import { useCoachSchedule } from "@/client/coach/use-coach-schedule";
import { useRosterPanel } from "@/client/coach/use-roster-panel";
import { useChangePassword } from "@/client/coach/use-change-password";

export default function CoachPage() {
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const auth     = useCoachAuth();
  const schedule = useCoachSchedule(auth.authed);
  const panel    = useRosterPanel({
    allPlayers:        schedule.allPlayers,
    showToast,
    onMarkAnnounced:   schedule.markAnnounced,
    onUnmarkAnnounced: schedule.unmarkAnnounced,
  });
  const changePw = useChangePassword(showToast);

  if (auth.checking) return (
    <div className="min-h-screen bg-ak-base flex items-center justify-center">
      <Spinner />
    </div>
  );

  if (!auth.authed) return (
    <div className="min-h-screen bg-ak-base flex items-center justify-center p-4">
      <LoginForm onLogin={auth.handleLogin} error={auth.loginError} />
    </div>
  );

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Coach Portal -- Armani Katehano</title>
      </Head>

      {/* Header */}
      <div className="bg-ak-surface border-b border-ak-border sticky top-0 z-40">
        <div className="max-w-[780px] mx-auto px-4 flex items-center justify-between h-[52px]">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-black text-ak-red tracking-[0.1em] uppercase">AK</span>
            <span className="text-[11px] font-bold text-ak-text-dim tracking-[0.08em] uppercase">Coach Portal</span>
          </div>
          <button onClick={auth.handleLogout} className="px-3 py-[5px] text-[10px] font-black tracking-[0.1em] uppercase bg-transparent border border-ak-border2 rounded-md text-ak-text-dim cursor-pointer">
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[780px] mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="text-[20px] font-black text-ak-text">Upcoming games</div>
          <div className="text-xs text-ak-text-dim mt-1">Select a game to announce or update the roster.</div>
        </div>

        {schedule.loadingData ? (
          <div className="flex justify-center py-[60px]"><Spinner /></div>
        ) : schedule.schedule.length === 0 ? (
          <div className="text-center py-10 text-ak-text-dim">No upcoming games scheduled.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {schedule.schedule.map(g => (
              <GameRow
                key={g.id}
                game={g}
                panelGameId={panel.panelGameId}
                announcedGameIds={schedule.announcedGameIds}
                onOpen={panel.openPanel}
                onClose={panel.closePanel}
                allPlayers={schedule.allPlayers}
                rosterSlots={panel.rosterSlots}
                rosterMsg={panel.rosterMsg}
                onRosterMsgChange={panel.setRosterMsg}
                panelLoading={panel.panelLoading}
                saving={panel.saving}
                selectedCount={panel.selectedCount}
                onTogglePlayer={panel.togglePlayer}
                onSetNote={panel.setNote}
                onPublish={panel.publish}
                onResendEmail={panel.resendEmail}
                onRemoveAnnouncement={panel.removeAnnouncement}
              />
            ))}
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="max-w-[780px] mx-auto px-4 pb-10">
        <div className="border-t border-ak-border pt-6">
          {!changePw.showChangePw ? (
            <button
              onClick={() => changePw.setShowChangePw(true)}
              className="bg-transparent border-0 text-[11px] text-ak-text-dim cursor-pointer p-0 font-sans font-bold tracking-[0.08em] uppercase"
            >
              Change password
            </button>
          ) : (
            <ChangePasswordForm
              currentPw={changePw.currentPw}   setCurrentPw={changePw.setCurrentPw}
              newPw={changePw.newPw}           setNewPw={changePw.setNewPw}
              confirmPw={changePw.confirmPw}   setConfirmPw={changePw.setConfirmPw}
              changingPw={changePw.changingPw}
              error={changePw.changePwError}
              onSubmit={changePw.changePassword}
              onCancel={() => { changePw.setShowChangePw(false); changePw.setChangePwError(null); }}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={[
          "fixed bottom-6 right-6 z-50 px-[18px] py-3 rounded-[10px] flex items-center gap-3 text-[13px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.25)]",
          toast.type === "error"
            ? "bg-[#8b1a1a22] text-ak-red-text border border-[#8b1a1a55]"
            : "bg-[#4caf7d22] text-ak-green border border-[#4caf7d55]",
        ].join(" ")}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="bg-transparent border-0 cursor-pointer text-[18px] text-current font-black leading-none p-0">×</button>
        </div>
      )}
    </>
  );
}

// ── Server-side: 404 if token doesn't match ───────────────────────────────────

export async function getServerSideProps({ params }: any) {
  const { isValidCoachToken } = await import("@/server/auth");
  if (!isValidCoachToken(params.token ?? "")) {
    return { notFound: true };
  }
  return { props: {} };
}
