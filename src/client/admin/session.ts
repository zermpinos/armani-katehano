import { createContext, useContext } from "react";

export type Toast = { type?: string; msg: string };
export type AdminSession = { slug: string; setToast: (t: Toast | null) => void };

export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error("useAdminSession must be used inside AdminShell");
  return session;
}
