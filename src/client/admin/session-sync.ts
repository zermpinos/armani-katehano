export type SessionView = { authed: boolean; expired: boolean; reloadAfterLogin: boolean };

export function afterPageLoad(view: SessionView, serverAuthed: boolean): SessionView {
  if (serverAuthed) return { authed: true, expired: false, reloadAfterLogin: false };
  // The new page mounted signed out, so its loads failed and must rerun after sign-in.
  if (view.authed) return { authed: true, expired: true, reloadAfterLogin: true };
  return view;
}

export function afterRelogin(view: SessionView): { view: SessionView; remount: boolean } {
  return {
    view:    { authed: true, expired: false, reloadAfterLogin: false },
    remount: view.reloadAfterLogin,
  };
}
