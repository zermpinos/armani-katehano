import React from "react";
import { Btn } from "./primitives";

interface Props {
  currentPw: string;
  setCurrentPw: (v: string) => void;
  newPw: string;
  setNewPw: (v: string) => void;
  confirmPw: string;
  setConfirmPw: (v: string) => void;
  changingPw: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function ChangePasswordForm({
  currentPw, setCurrentPw, newPw, setNewPw, confirmPw, setConfirmPw,
  changingPw, error, onSubmit, onCancel,
}: Props) {
  return (
    <div className="max-w-[360px]">
      <div className="text-[13px] font-black text-ak-text mb-[14px]">Change password</div>
      <form onSubmit={onSubmit} className="flex flex-col gap-[10px]">
        {[
          { label: "Current password", value: currentPw,  setter: setCurrentPw },
          { label: "New password",      value: newPw,      setter: setNewPw },
          { label: "Confirm password",  value: confirmPw,  setter: setConfirmPw },
        ].map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-[10px] font-black tracking-[0.12em] text-ak-text-dim uppercase mb-1">{label}</label>
            <input
              type="password"
              value={value}
              onChange={e => setter(e.target.value)}
              required
              className="w-full py-2 px-3 text-[13px] rounded-lg border border-ak-border2 bg-ak-base text-ak-text font-sans outline-none"
            />
          </div>
        ))}
        {error && <div className="text-xs text-ak-red-text">{error}</div>}
        <div className="flex gap-2 mt-1">
          <Btn variant="green" disabled={changingPw}>
            {changingPw ? "SAVING…" : "UPDATE PASSWORD"}
          </Btn>
          <Btn variant="ghost" onClick={onCancel}>CANCEL</Btn>
        </div>
      </form>
    </div>
  );
}
