import prisma from "@/server/db/client";

const LEVENSHTEIN_MAX_RATIO = 0.40;

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

export async function matchUpcomingGame(dateStr: string, opponent: string) {
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd   = new Date(`${dateStr}T23:59:59.999Z`);

  const candidates = await prisma.upcomingGame.findMany({
    where:   { scheduledFor: { gte: dayStart, lte: dayEnd } },
    include: { importJobs: true },
  });

  if (candidates.length === 0) return null;

  const normOpponent = normalize(opponent);
  let best: (typeof candidates)[0] | null = null;
  let bestDist = Infinity;

  for (const c of candidates) {
    const normDb = normalize(c.opponent);
    const dist   = levenshtein(normOpponent, normDb);
    const ratio  = dist / Math.max(normOpponent.length, normDb.length, 1);
    if (ratio <= LEVENSHTEIN_MAX_RATIO && dist < bestDist) {
      bestDist = dist;
      best     = c;
    }
  }

  return best;
}
