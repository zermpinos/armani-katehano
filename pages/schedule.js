import Layout from "../components/Layout";
import { SectionHeading } from "../components/ui";
import { C } from "../lib/theme";
import { getAllPublicData } from "../lib/data";
import { fmtDate } from "../lib/utils";

export default function SchedulePage({ schedule, games }) {
  const upcoming = [...schedule].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent   = [...games].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <Layout title="Schedule">
      <SectionHeading label="2025–26 Season" title="Schedule" right={`${upcoming.length} Upcoming`} />

      {upcoming.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:C.textDim }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
          <div style={{ fontSize:15, fontWeight:700 }}>No upcoming games scheduled</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:32 }}>
          {upcoming.map(g => (
            <div key={g.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderRadius:12, border:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{
                  fontSize:10, fontWeight:900, letterSpacing:"0.12em", padding:"4px 8px", borderRadius:6, textTransform:"uppercase",
                  background: g.home ? `${C.red}25` : C.border2,
                  color: g.home ? C.redText : C.textSub,
                }}>{g.home ? "HOME" : "AWAY"}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>vs {g.opponent}</div>
                  <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{fmtDate(g.date)}</div>
                </div>
              </div>
              <div style={{ fontSize:20 }}>📅</div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim, marginBottom:12, textTransform:"uppercase" }}>Recent Results</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recent.map(g => (
              <div key={g.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", borderRadius:12, border:`1px solid ${C.border}`, background:C.surface }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{
                    width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:900,
                    background: g.result==="W" ? `${C.green}20` : `${C.red}30`,
                    color: g.result==="W" ? C.green : C.redText,
                  }}>{g.result}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{g.home ? "vs" : "@"} {g.opponent}</div>
                    <div style={{ fontSize:11, color:C.textDim }}>{fmtDate(g.date)}</div>
                  </div>
                </div>
                <div style={{ fontSize:15, fontWeight:900, color:C.text }}>{g.score}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  const { schedule, games } = await getAllPublicData();
  return { props: { schedule, games }, revalidate: 3600 };
}
