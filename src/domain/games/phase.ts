const PHASE_LABELS: Record<string, string> = {
  regular:      "Regular Season",
  quarterfinal: "Playoffs · Quarterfinal",
  semifinal:    "Playoffs · Semifinal",
  final:        "Playoffs · Final",
};

export function phaseLabel(phase: string): string {
  // eslint-disable-next-line security/detect-object-injection
  return PHASE_LABELS[phase] ?? "Regular Season";
}
