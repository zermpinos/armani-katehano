import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Head from "next/head";
import { C } from "../lib/theme";

const NAV_LINKS = [
  { href: "/",           label: "Home"       },
  { href: "/players",    label: "Players"    },
  { href: "/leaderboard",label: "Leaderboard"},
  { href: "/games",      label: "Games"      },
  { href: "/team",       label: "Team Stats" },
  { href: "/schedule",   label: "Schedule"   },
];

export default function Layout({ children, title = "Armani Katehano" }) {
  const router      = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Head>
        <title>{title === "Armani Katehano" ? title : `${title} · Armani Katehano`}</title>
        <meta name="description" content="Armani Katehano Basketball -- Season Stats 2025-26" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1c1c1e" />
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
              <div style={{ display:"none" }} className="brand-text">
                <div style={{ fontWeight:900, fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase", lineHeight:1, color:C.text }}>Armani Katehano</div>
                <div style={{ fontWeight:700, fontSize:11, letterSpacing:"0.15em", marginTop:1, color:C.redText }}>2025-26</div>
              </div>
            </Link>

            {/* Desktop nav */}
            <div style={{ display:"flex", alignItems:"center", gap:2 }}>
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

            {/* Mobile hamburger */}
            <button onClick={() => setOpen(o => !o)} aria-label="Menu" style={{
              background:"none", border:"none", cursor:"pointer", padding:4, color:C.textSub,
            }}>
              <div style={{ width:20, display:"flex", flexDirection:"column", gap:4 }}>
                <span style={{ display:"block", height:2, background:"currentColor", borderRadius:1, transition:"all 0.2s", transform: open ? "rotate(45deg) translateY(6px)" : "none" }} />
                <span style={{ display:"block", height:2, background:"currentColor", borderRadius:1, opacity: open ? 0 : 1 }} />
                <span style={{ display:"block", height:2, background:"currentColor", borderRadius:1, transition:"all 0.2s", transform: open ? "rotate(-45deg) translateY(-6px)" : "none" }} />
              </div>
            </button>
          </div>

          {/* Mobile menu */}
          {open && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingBottom:12 }}>
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} style={{
                  display:"block", padding:"10px 16px", fontSize:12,
                  fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase",
                  color: router.pathname === link.href ? C.redText : C.textDim,
                }}>{link.label}</Link>
              ))}
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
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.12em", color:C.textDim, textTransform:"uppercase" }}>© 2026 Armani Katehano · 2025-26</div>
          </div>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.12em", color:C.border2 }}>AK STATS ENGINE</div>
        </div>
      </footer>

      <style>{`
        @media (min-width: 640px) { .brand-text { display: block !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        * { box-sizing: border-box; }
        a { text-decoration: none; color: inherit; }
        input, select { outline: none; }
      `}</style>
    </>
  );
}
