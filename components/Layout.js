import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Head from "next/head";
import { C } from "../lib/theme";
import { SITE_NAME, CURRENT_SEASON, COPYRIGHT_YEAR } from "../lib/constants.js";


const NAV_LINKS = [
  { href: "/",           label: "Home"       },
  { href: "/players",    label: "Players"    },
  { href: "/leaderboard",label: "Leaderboard"},
  { href: "/games",      label: "Games"      },
  { href: "/team",       label: "Team Stats" },
];

export default function Layout({ children, title = SITE_NAME }) {
  const router      = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Head>
        <title>{title === SITE_NAME ? title : `${title} · ${SITE_NAME}`}</title>
        <meta name="description" content={`${SITE_NAME} Basketball — Season Stats ${CURRENT_SEASON}`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1c1c1e" />
        <meta property="og:title" content={title === SITE_NAME ? title : `${title} · ${SITE_NAME}`} />
        <meta property="og:description" content={`${SITE_NAME} Basketball — Season Stats ${CURRENT_SEASON}`} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/logo.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title === SITE_NAME ? title : `${title} · ${SITE_NAME}`} />
        <meta name="twitter:description" content={`${SITE_NAME} Basketball — Season Stats ${CURRENT_SEASON}`} />
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

            {/* Desktop nav — hidden on mobile via CSS */}
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

            {/* Mobile hamburger — hidden on desktop via CSS */}
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
      <main style={{ maxWidth:1280, margin:"0 auto", padding:"88px 16px 48px" }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ borderTop:`1px solid ${C.border}`, padding:"20px 16px" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="/logo.png" alt="AK" style={{ width:20, height:20, objectFit:"contain", opacity:0.5 }} />
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.12em", color:C.textDim, textTransform:"uppercase" }}>© {COPYRIGHT_YEAR} {SITE_NAME} · {CURRENT_SEASON}</div>
          </div>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.12em", color:C.border2 }}>AK STATS ENGINE</div>
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
