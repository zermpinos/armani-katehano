
export interface ColorTokens {
  base:      string;
  surface:   string;
  surface2:  string;
  border:    string;
  border2:   string;
  red:       string;
  redBright: string;
  redText:   string;
  text:      string;
  textSub:   string;
  textDim:   string;
  gold:      string;
  silver:    string;
  bronze:    string;
  green:     string;
  greenDim:  string;
}

export const C: ColorTokens = {
  base:      "#1c1c1e",
  surface:   "#242426",
  surface2:  "#2a2a2c",
  border:    "#333336",
  border2:   "#3d3d40",
  red:       "#8b1a1a",
  redBright: "#c0392b",
  redText:   "#ec6666",
  text:      "#f0ede8",
  textSub:   "#a8a8ac",
  textDim:   "#919196",
  gold:      "#c9a84c",
  silver:    "#9ba3af",
  bronze:    "#b87333",
  green:     "#4caf7d",
  greenDim:  "#2d6b4a",
};

export const chartTooltipStyle = {
  contentStyle: { background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, fontSize: 12, color: C.text },
  labelStyle:   { color: C.redText, fontWeight: 700 },
};
