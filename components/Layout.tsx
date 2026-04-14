import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Head from "next/head";
import { C } from "../lib/theme";
import { SITE_NAME, CURRENT_SEASON, COPYRIGHT_YEAR } from "../lib/constants";


const NAV_LINKS = [
  { href: "/",           label: "Home"       },
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
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:50,
        background:C.base, borderBottom:`1px solid ${C.border}`,
      }}>
        {/* Red top accent */}
        <div style={{ height:3, background:`linear-gradient(90deg,${C.red},${C.redBright},${C.red})` }} />

        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:60 }}>

            {/* Brand */}
            <Link href="/" style={{ display:"flex", alignItems:"center", gap:12 }}>
              <img
                src="/logo.png"
                alt="Armani Katehano"
                style={{ width:40, height:40, objectFit:"contain", flexShrink:0 }}
              />
              <div className="brand-text">
                <div style={{ fontWeight:900, fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase", lineHeight:1, color:C.text }}>Armani Katehano</div>
                <div style={{ fontWeight:700, fontSize:11, letterSpacing:"0.15em", marginTop:1, color:C.redText }}>{CURRENT_SEASON}</div>
              </div>
            </Link>

            {/* Desktop nav -- hidden on mobile via CSS */}
            <div className="desktop-nav" style={{ display:"flex", alignItems:"center", gap:2 }}>
              {NAV_LINKS.map(link => {
                const active = router.pathname === link.href;
                return (
                  <Link key={link.href} href={link.href} style={{
                    padding:"6px 12px", fontSize:11, fontWeight:900,
                    letterSpacing:"0.12em", textTransform:"uppercase", borderRadius:6,
                    color: active ? C.redText : C.textDim,
                    background: active ? `${C.red}25` : "transparent",
                  }}>{link.label}</Link>
                );
              })}
            </div>

            {/* Mobile hamburger -- hidden on desktop via CSS */}
            <button
              className="hamburger"
              onClick={() => setOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={open}
              style={{
                background:"none", border:"none", cursor:"pointer", padding:8,
                color:C.textSub, borderRadius:6,
              }}
            >
              <div style={{ width:22, display:"flex", flexDirection:"column", gap:5 }}>
                <span style={{ display:"block", height:2, background:"currentColor", borderRadius:1, transition:"all 0.2s", transform: open ? "rotate(45deg) translateY(7px)" : "none" }} />
                <span style={{ display:"block", height:2, background:"currentColor", borderRadius:1, transition:"opacity 0.2s", opacity: open ? 0 : 1 }} />
                <span style={{ display:"block", height:2, background:"currentColor", borderRadius:1, transition:"all 0.2s", transform: open ? "rotate(-45deg) translateY(-7px)" : "none" }} />
              </div>
            </button>
          </div>

          {/* Mobile dropdown menu */}
          {open && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingBottom:8 }} className="mobile-menu">
              {NAV_LINKS.map(link => {
                const active = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    style={{
                      display:"block", padding:"12px 16px", fontSize:13,
                      fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase",
                      color: active ? C.redText : C.textDim,
                      background: active ? `${C.red}15` : "transparent",
                      borderRadius:6, margin:"2px 0",
                    }}
                  >{link.label}</Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Page content */}
      <main style={{ maxWidth:1280, margin:"0 auto", padding:"88px 16px 48px", flexGrow:1, width:"100%" }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ borderTop:`1px solid ${C.border}`, padding:"20px 16px" }}>
        <div className="footer-inner" style={{ maxWidth:1280, margin:"0 auto" }}>

          {/* Left: copyright */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="/logo.png" alt="AK" style={{ width:20, height:20, objectFit:"contain", opacity:0.5 }} />
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.12em", color:C.text, textTransform:"uppercase" }}>© {COPYRIGHT_YEAR} {SITE_NAME} · {CURRENT_SEASON}</div>
          </div>

          {/* Center: Instagram */}
          <a
            href="https://www.instagram.com/armanikatehano_b.c/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:"flex", alignItems:"center", gap:8,
              fontSize:13, fontWeight:900, letterSpacing:"0.08em",
              color:C.text,
              background:`linear-gradient(135deg,${C.red},${C.base})`,
              border:`1px solid ${C.redBright}`,
              borderRadius:8, padding:"7px 16px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={C.redText}>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            @armanikatehano_b.c
          </a>

          {/* Right: credit */}
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.08em", color:C.text }}>made with ❤️‍🔥 by @p.zermpinos</div>

        </div>
      </footer>

      <style>{`
        /* Brand text: hidden on mobile, shown on ≥640px */
        .brand-text { display: none; }
        @media (min-width: 640px) { .brand-text { display: block; } }

        /* Desktop nav: hidden on mobile, shown on ≥640px */
        .desktop-nav { display: none !important; }
        @media (min-width: 640px) {
          .desktop-nav { display: flex !important; }
          .hamburger   { display: none !important; }
          .mobile-menu { display: none !important; }
        }

        /* Footer: stack on mobile, row on desktop */
        .footer-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-align: center;
        }
        @media (min-width: 640px) {
          .footer-inner {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            text-align: left;
          }
        }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        * { box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        input, select { outline: none; }
      `}</style>
    </>
  );
}
