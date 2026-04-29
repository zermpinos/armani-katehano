import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Head from "next/head";
import { SITE_NAME, CURRENT_SEASON, COPYRIGHT_YEAR } from "@/domain/shared/constants";

const NAV_LINKS = [
  { href: "/",            label: "Home"       },
  { href: "/players",    label: "Players"    },
  { href: "/leaderboard",label: "Leaderboard"},
  { href: "/games",      label: "Games"      },
  { href: "/team-stats", label: "Team Stats" },
];

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  ogDescription?: string;
}

export default function Layout({ children, title = SITE_NAME, ogDescription }: LayoutProps) {
  const router      = useRouter();
  const [open, setOpen] = useState(false);

  const pageTitle = title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;
  const desc      = ogDescription ?? `${SITE_NAME} Basketball -- Season Stats ${CURRENT_SEASON}`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={desc} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1c1c1e" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/logo.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={desc} />
        <link rel="icon" type="image/png" href="/logo.png" />
      </Head>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ak-base border-b border-ak-border">
        {/* Red top accent */}
        <div className="h-[3px] bg-gradient-to-r from-ak-red via-ak-red-bright to-ak-red" />

        <div className="max-w-[1280px] mx-auto px-4">
          <div className="flex items-center justify-between h-[60px]">

            {/* Brand */}
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Armani Katehano"
                width={40}
                height={40}
                className="object-contain shrink-0"
              />
              {/* Hidden on mobile, visible on sm+ */}
              <div className="hidden sm:block">
                <div className="font-black text-[13px] tracking-[0.1em] uppercase leading-none text-ak-text">
                  Armani Katehano
                </div>
                <div className="font-bold text-[11px] tracking-[0.15em] mt-0.5 text-ak-red-text">
                  {CURRENT_SEASON}
                </div>
              </div>
            </Link>

            {/* Desktop nav -- hidden on mobile */}
            <div className="hidden sm:flex items-center gap-0.5">
              {NAV_LINKS.map(link => {
                const active = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "px-3 py-[6px] text-[11px] font-black tracking-[0.12em] uppercase rounded-md transition-colors duration-150",
                      active
                        ? "text-ak-red-text bg-[#8b1a1a25]"
                        : "text-ak-text-dim bg-transparent hover:text-ak-text hover:bg-[#ffffff08]",
                    ].join(" ")}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Mobile hamburger -- hidden on sm+ */}
            <button
              className="sm:hidden bg-transparent border-0 cursor-pointer p-2 text-ak-text-sub rounded-md"
              onClick={() => setOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={open}
            >
              <div className="w-[22px] flex flex-col gap-[5px]">
                <span
                  className={[
                    "block h-0.5 bg-current rounded-[1px] transition-all duration-200",
                    open ? "rotate-45 translate-y-[7px]" : "",
                  ].join(" ")}
                />
                <span
                  className={[
                    "block h-0.5 bg-current rounded-[1px] transition-opacity duration-200",
                    open ? "opacity-0" : "opacity-100",
                  ].join(" ")}
                />
                <span
                  className={[
                    "block h-0.5 bg-current rounded-[1px] transition-all duration-200",
                    open ? "-rotate-45 -translate-y-[7px]" : "",
                  ].join(" ")}
                />
              </div>
            </button>
          </div>

          {/* Mobile dropdown */}
          <div className={`sm:hidden overflow-hidden transition-all duration-200 ${open ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="border-t border-ak-border pb-2">
              {NAV_LINKS.map(link => {
                const active = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "block px-4 py-3 text-[13px] font-black tracking-[0.12em] uppercase rounded-md my-0.5 transition-colors duration-150",
                      active
                        ? "text-ak-red-text bg-[#8b1a1a15]"
                        : "text-ak-text-dim bg-transparent hover:text-ak-text hover:bg-[#ffffff08]",
                    ].join(" ")}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-[1280px] mx-auto pt-[88px] pb-12 px-4 grow w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-ak-border px-4 py-5">
        <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-3.5 text-center sm:flex-row sm:justify-between sm:text-left">

          {/* Copyright */}
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="AK" width={20} height={20} className="object-contain opacity-50" />
            <div className="text-[11px] font-black tracking-[0.12em] text-ak-text uppercase">
              © {COPYRIGHT_YEAR} {SITE_NAME} · {CURRENT_SEASON}
            </div>
          </div>

          {/* Instagram */}
          <a
            href="https://www.instagram.com/armanikatehano_b.c/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.08em] text-ak-text-dim transition-colors duration-150 hover:text-ak-text"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            @armanikatehano_b.c
          </a>

          {/* Credit */}
          <div className="text-[11px] font-black tracking-[0.08em] text-ak-text-dim">
            made with ❤️‍🔥 by @p.zermpinos
          </div>
        </div>
      </footer>
    </>
  );
}
