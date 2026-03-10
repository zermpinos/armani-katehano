import Link from "next/link";
import { C } from "../lib/theme";

export default function Custom404() {
  return (
    <div style={{ minHeight:"100vh", background:C.base, color:C.text, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Trebuchet MS','Gill Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:96, fontWeight:900, color:C.border, lineHeight:1 }}>404</div>
        <div style={{ fontSize:16, fontWeight:700, color:C.textDim, marginTop:8 }}>Page not found</div>
        <Link href="/" style={{ display:"inline-block", marginTop:20, padding:"9px 20px", borderRadius:8, background:C.red, color:C.text, fontWeight:900, fontSize:13, letterSpacing:"0.12em", textTransform:"uppercase" }}>← HOME</Link>
      </div>
    </div>
  );
}
