import React, { useState } from "react";
import { coachFetch } from "./csrf";

export function useChangePassword(showToast: (msg: string, type?: string) => void) {
  const [showChangePw,  setShowChangePw]  = useState(false);
  const [currentPw,     setCurrentPw]     = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");
  const [changingPw,    setChangingPw]    = useState(false);
  const [changePwError, setChangePwError] = useState<string | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwError(null);
    if (newPw !== confirmPw) { setChangePwError("New passwords don't match."); return; }
    if (newPw.length < 8)    { setChangePwError("Password must be at least 8 characters."); return; }
    setChangingPw(true);
    try {
      const res = await coachFetch("/api/coach/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.ok) {
        // Session was cleared server-side - force re-login with the new password.
        showToast("Password updated. Please log in again.");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        setChangePwError(d.error ?? "Failed to change password.");
      }
    } finally { setChangingPw(false); }
  };

  return {
    showChangePw, setShowChangePw,
    currentPw, setCurrentPw,
    newPw, setNewPw,
    confirmPw, setConfirmPw,
    changingPw, changePwError, setChangePwError,
    changePassword,
  };
}
