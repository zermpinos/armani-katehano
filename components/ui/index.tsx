import React, { useEffect } from "react";
import { C } from "../../lib/theme";

// ── Player silhouette SVG ────────────────────────────────────────────────────

interface PlayerSilhouetteProps {
  style?: React.CSSProperties;
}

export function PlayerSilhouette({ style = {} }: PlayerSilhouetteProps) {
  return (
    <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <circle cx="50" cy="28" r="18" fill="currentColor" opacity="0.55" />
      <path d="M18 115 C18 85 28 70 50 68 C72 70 82 85 82 115Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

// ── Section heading with red left bar ────────────────────────────────────────

interface SectionHeadingProps {
  label?: string;
  title: string;
  right?: React.ReactNode;
}

export function SectionHeading({ label, title, right }: SectionHeadingProps) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ width:4, alignSelf:"stretch", borderRadius:2, background:C.redBright, minHeight:32 }} />
        <div>
          {label && <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", marginBottom:2, color:C.redText, textTransform:"uppercase" }}>{label}</div>}
          <h2 style={{ fontSize:22, fontWeight:900, textTransform:"uppercase", letterSpacing:"-0.02em", color:C.text }}>{title}</h2>
        </div>
      </div>
      {right && <div style={{ fontSize:11, fontWeight:900, letterSpacing:"0.15em", color:C.textDim }}>{right}</div>}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  highlight?: boolean;
}

export function StatTile({ label, value, sub, highlight }: StatTileProps) {
  return (
    <div style={{
      borderRadius:12, padding:"14px 12px", textAlign:"center", border:`1px solid ${highlight ? `${C.redBright}55` : C.border}`,
      background: highlight ? `${C.red}22` : C.surface,
    }}>
      <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.15em", marginBottom:4, color:C.textDim }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:900, color: highlight ? C.redText : C.text }}>{value}</div>
      {sub && <div style={{ fontSize:11, marginTop:2, color:C.textDim }}>{sub}</div>}
    </div>
  );
}

// ── Primary / ghost / danger button ──────────────────────────────────────────

interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function Btn({ children, onClick, variant = "primary", size = "md", disabled = false, type = "button" }: BtnProps) {
  const bg  = variant==="primary" ? C.red : variant==="danger" ? "#7f1d1d" : variant==="ghost" ? "transparent" : C.surface2;
  const bc  = variant==="ghost" ? C.border2 : "transparent";
  const col = variant==="ghost" ? C.textSub : C.text;
  const pad = size==="sm" ? "6px 12px" : "9px 18px";
  const fs  = size==="sm" ? 11 : 13;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding:pad, fontSize:fs, fontWeight:900, letterSpacing:"0.12em",
      borderRadius:8, border:`1px solid ${bc}`, background:bg, color:col,
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1,
      fontFamily:"inherit", transition:"opacity 0.15s",
    }}>
      {children}
    </button>
  );
}

// ── Inline text field ─────────────────────────────────────────────────────────

interface FieldProps {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  small?: boolean;
}

export function Field({ label, value, onChange, type = "text", placeholder = "", small = false }: FieldProps) {
  return (
    <div>
      {label && <label style={{ display:"block", fontSize:10, fontWeight:900, letterSpacing:"0.15em", marginBottom:6, color:C.textDim, textTransform:"uppercase" }}>{label}</label>}
      <input
        type={type} value={value ?? ""} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:"100%", padding: small ? "6px 8px" : "9px 12px",
          fontSize: small ? 12 : 13, borderRadius:8,
          border:`1px solid ${C.border2}`, background:C.base, color:C.text,
          fontFamily:"inherit", outline:"none",
        }}
      />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div>
      {label && <label style={{ display:"block", fontSize:10, fontWeight:900, letterSpacing:"0.15em", marginBottom:6, color:C.textDim, textTransform:"uppercase" }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width:"100%", padding:"9px 12px", fontSize:13, borderRadius:8,
        border:`1px solid ${C.border2}`, background:C.base, color:C.text,
        fontFamily:"inherit", outline:"none",
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onDone: () => void;
}

export function Toast({ message, type = "success", onDone }: ToastProps) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position:"fixed", bottom:24, right:24, zIndex:200,
      display:"flex", alignItems:"center", gap:10,
      borderRadius:12, padding:"12px 20px", boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
      background:C.surface2, color:C.text, fontSize:14, fontWeight:600,
      border:`1px solid ${type==="success" ? `${C.green}60` : `${C.redText}60`}`,
    }}>
      <span>{type==="success" ? "✓" : "✕"}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:150, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.75)" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:16, padding:24, width:"100%", maxWidth:360, boxShadow:"0 16px 48px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize:17, fontWeight:900, color:C.text, marginBottom:8 }}>Are you sure?</div>
        <div style={{ fontSize:13, color:C.textSub, marginBottom:24 }}>{message}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 32 }: SpinnerProps) {
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      border:`2px solid ${C.border2}`, borderTopColor:C.redBright,
      animation:"spin 0.7s linear infinite",
    }} />
  );
}
