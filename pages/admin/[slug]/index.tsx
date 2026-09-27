import Link from "next/link";
import type { GetServerSidePropsContext } from "next";
import { adminLayout, useAdminSession } from "@/client/admin";
import { getAdminPageProps } from "@/server/auth";

const TASKS = [
  { path: "import",    label: "Import game", desc: "Box score from a game URL",     icon: "↓" },
  { path: "schedule",  label: "Schedule",    desc: "Upcoming fixtures and times",   icon: "+" },
  { path: "roster",    label: "Roster",      desc: "Players, numbers and photos",   icon: "#" },
  { path: "broadcast", label: "Broadcast",   desc: "Email every subscriber",        icon: "✉" },
];

export default function AdminHome() {
  const { slug } = useAdminSession();
  return (
    <>
      <h1 className="mb-5 text-[22px] font-black text-ak-text md:text-[28px]">Admin</h1>
      <nav aria-label="Tasks" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TASKS.map(t => (
          <Link
            key={t.path}
            href={`/admin/${slug}/${t.path}`}
            className="flex min-h-[88px] items-center gap-4 rounded-xl border border-ak-border bg-ak-surface px-5 py-4 hover:border-ak-border2"
          >
            <span aria-hidden="true" className="w-8 text-center text-[24px] text-ak-text-dim">{t.icon}</span>
            <span className="min-w-0">
              <span className="block text-[16px] font-black text-ak-text">{t.label}</span>
              <span className="block text-[12px] text-ak-text-dim">{t.desc}</span>
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}

AdminHome.getLayout = adminLayout("Home");

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return getAdminPageProps(ctx);
}
