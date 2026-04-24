/**
 * components/Charts.js
 * Re-exports recharts. Not SSR-safe -- only use in client-rendered contexts.
 */
export {
  LineChart, BarChart, RadarChart,
  Line, Bar, Area, Cell, Radar,
  LabelList,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";