/**
 * components/Charts.js
 * Re-exports recharts. Not SSR-safe — only use in client-rendered contexts.
 */
export {
  LineChart, BarChart, RadarChart,
  Line, Bar, Cell, Radar,
  PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";