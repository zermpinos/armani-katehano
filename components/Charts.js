/**
 * components/Charts.js
 * Lazy-loaded Recharts wrapper — prevents recharts from being included in the SSR bundle.
 */
import dynamic from "next/dynamic";

export const LineChart        = dynamic(() => import("recharts").then(m => ({ default: m.LineChart })),        { ssr: false });
export const BarChart         = dynamic(() => import("recharts").then(m => ({ default: m.BarChart })),         { ssr: false });
export const RadarChart       = dynamic(() => import("recharts").then(m => ({ default: m.RadarChart })),       { ssr: false });
export const Line             = dynamic(() => import("recharts").then(m => ({ default: m.Line })),             { ssr: false });
export const Bar              = dynamic(() => import("recharts").then(m => ({ default: m.Bar })),              { ssr: false });
export const Cell             = dynamic(() => import("recharts").then(m => ({ default: m.Cell })),             { ssr: false });
export const Radar            = dynamic(() => import("recharts").then(m => ({ default: m.Radar })),            { ssr: false });
export const PolarGrid        = dynamic(() => import("recharts").then(m => ({ default: m.PolarGrid })),        { ssr: false });
export const PolarAngleAxis   = dynamic(() => import("recharts").then(m => ({ default: m.PolarAngleAxis })),   { ssr: false });
export const XAxis            = dynamic(() => import("recharts").then(m => ({ default: m.XAxis })),            { ssr: false });
export const YAxis            = dynamic(() => import("recharts").then(m => ({ default: m.YAxis })),            { ssr: false });
export const CartesianGrid    = dynamic(() => import("recharts").then(m => ({ default: m.CartesianGrid })),    { ssr: false });
export const Tooltip          = dynamic(() => import("recharts").then(m => ({ default: m.Tooltip })),          { ssr: false });
export const ResponsiveContainer = dynamic(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })), { ssr: false });
export const Legend           = dynamic(() => import("recharts").then(m => ({ default: m.Legend })),           { ssr: false });
