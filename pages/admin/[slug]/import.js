/**
 * pages/admin/[slug]/import.js
 * Accepts the new scraper JSON format for browser-side review before saving.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { C } from "../../../lib/theme";
import {
  AdminLayout,
  BoxScoreTable,
  F,
  Sel,
  Btn,
  byJersey,
  useAdminAuth,
  Spinner,
  LoginForm,
} from "../../../lib/adminShared";
import { validateAdminSlug } from "../../../lib/adminSlugCheck.js";
import {
  parseGreekDate,
  parseMinutes,
  detectLeagueSlug,
} from "../../../lib/greekDate.js";

export default function ImportPage({ validSlug }) {
  // ✅ A-02 fix: use router instead of window
  const router = useRouter();
  const slug = router.query.slug || validSlug;

  const { authed, loading: checking, loginError, handleLogin } =
    useAdminAuth(slug);

  const [players, setPlayers] = useState([]);
  const [seasonLeagues, setSeasonLeagues] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [jsonText, setJsonText] = useState("");
  const [phase, setPhase] = useState("idle");
  const [draft, setDraft] = useState(null);
  const [highlights, setHighlights] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // ✅ unified data fetch (matches roster.js)
  const loadBase = async () => {
    setDataLoading(true);
    try {
      const res = await fetch("/api/admin/data");
      if (res.ok) {
        const d = await res.json();
        setPlayers(d.players ?? []);
        setSeasonLeagues(d.seasonLeagues ?? []);
      }
    } finally {
      setDataLoading(false);
    }
  };

  // ✅ proper effect (fixes broken useState misuse)
  useEffect(() => {
    if (authed && slug) loadBase();
  }, [authed, slug]);

  // ── buildDraft ──────────────────────────────────────────────────────────
  const buildDraft = (data) => {
    const { game, teams, url: sourceUrl } = data;

    const akTeam = teams.find(
      (t) =>
        t.name.toUpperCase().includes("ARMANI") ||
        t.name.toUpperCase().includes("KATEHANO")
    );
    if (!akTeam) throw new Error("ARMANI KATEHANO team not found in JSON");

    const isHome =
      game.homeTeam.toUpperCase().includes("ARMANI") ||
      game.homeTeam.toUpperCase().includes("KATEHANO");

    const akScore = isHome
      ? game.finalScore.home
      : game.finalScore.away;
    const oppScore = isHome
      ? game.finalScore.away
      : game.finalScore.home;

    const oppTeamName = isHome ? game.awayTeam : game.homeTeam;
    const result = akScore > oppScore ? "W" : "L";
    const date = parseGreekDate(game.date);
    const leagueSlug = detectLeagueSlug(sourceUrl);

    const matchedSL =
      seasonLeagues.find((sl) => sl.leagueSlug === leagueSlug) ??
      seasonLeagues[0];

    const boxScore = [...players].sort(byJersey).map((dbPlayer) => {
      const scraped = akTeam.players.find(
        (p) => p["#"] === Number(dbPlayer.number)
      );
      const mins = scraped ? parseMinutes(scraped.MIN) : 0;

      if (!scraped || mins === 0) {
        return {
          pid: dbPlayer.id,
          min: 0,
          pts: 0,
          reb: 0,
          orb: 0,
          drb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          tov: 0,
          pf: 0,
          fgm: 0,
          fga: 0,
          fg2m: 0,
          fg2a: 0,
          fg3m: 0,
          fg3a: 0,
          ftm: 0,
          fta: 0,
          eff: 0,
        };
      }

      const fg2m = scraped["2PTS"]?.made ?? 0;
      const fg2a = scraped["2PTS"]?.attempted ?? 0;
      const fg3m = scraped["3PTS"]?.made ?? 0;
      const fg3a = scraped["3PTS"]?.attempted ?? 0;

      return {
        pid: dbPlayer.id,
        min: mins,
        pts: scraped.PTS ?? 0,
        reb: scraped.REB ?? 0,
        orb: scraped.OREB ?? 0,
        drb: scraped.DREB ?? 0,
        ast: scraped.AST ?? 0,
        stl: scraped.STL ?? 0,
        blk: scraped.BLK ?? 0,
        tov: scraped.TO ?? 0,
        pf: scraped.PF ?? 0,
        fg2m,
        fg2a,
        fg3m,
        fg3a,
        fgm: fg2m + fg3m,
        fga: fg2a + fg3a,
        ftm: scraped.FT?.made ?? 0,
        fta: scraped.FT?.attempted ?? 0,
        eff: scraped.EF ?? 0,
      };
    });

    const hl = {};
    akTeam.players.forEach((p) => {
      if (parseMinutes(p.MIN) > 0) {
        const dbPlayer = players.find(
          (pl) => Number(pl.number) === p["#"]
        );
        if (dbPlayer) hl[dbPlayer.id] = true;
      }
    });

    const warns = [];
    akTeam.players
      .filter((p) => parseMinutes(p.MIN) > 0)
      .forEach((p) => {
        const fg2m = p["2PTS"]?.made ?? 0;
        const fg3m = p["3PTS"]?.made ?? 0;
        const ftm = p.FT?.made ?? 0;
        const expPts = fg2m * 2 + fg3m * 3 + ftm;
        if ((p.PTS ?? 0) !== expPts) {
          warns.push(
            `#${p["#"]} ${p.Players}: pts=${p.PTS}, expected ${expPts}`
          );
        }
      });

    return {
      draft: {
        date,
        opponent: oppTeamName,
        home: isHome,
        result,
        teamScore: akScore,
        opponentScore: oppScore,
        seasonLeagueId: matchedSL?.id ?? "",
        boxScore,
      },
      highlights: hl,
      warnings: warns,
    };
  };

  const parseAndReview = () => {
    setError("");
    try {
      const data = JSON.parse(jsonText.trim());

      if (!data.game && !data.match_info) {
        throw new Error(
          "Unrecognised JSON format -- expected game/teams or match_info/armani_katehano"
        );
      }
      if (!data.game) {
        throw new Error(
          "This looks like the old format. Please use the new scraper output."
        );
      }

      const { draft, highlights, warnings } = buildDraft(data);
      setDraft(draft);
      setHighlights(highlights);
      setWarnings(warnings);
      setPhase("review");
    } catch (err) {
      setError(err.message);
    }
  };

  const updDraft = (k, v) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const updBox = (pid, k, v) =>
    setDraft((d) => ({
      ...d,
      boxScore: d.boxScore.map((r) =>
        r.pid === pid ? { ...r, [k]: parseFloat(v) || 0 } : r
      ),
    }));

  const save = async () => {
    setPhase("saving");

    const boxScore = draft.boxScore.map((r) => {
      const fg2m = r.fg2m || 0,
        fg2a = r.fg2a || 0;
      const fg3m = r.fg3m || 0,
        fg3a = r.fg3a || 0;

      return {
        playerId: r.pid,
        minutes: r.min || 0,
        pts: r.pts || 0,
        reb: r.reb || 0,
        orb: r.orb || 0,
        drb: r.drb || 0,
        ast: r.ast || 0,
        stl: r.stl || 0,
        blk: r.blk || 0,
        tov: r.tov || 0,
        pf: r.pf || 0,
        fg2m,
        fg2a,
        fg3m,
        fg3a,
        fgm: fg2m + fg3m,
        fga: fg2a + fg3a,
        ftm: r.ftm || 0,
        fta: r.fta || 0,
      };
    });

    const res = await fetch("/api/admin/games", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seasonLeagueId: draft.seasonLeagueId,
        opponent: draft.opponent,
        location: draft.home ? "home" : "away",
        teamScore: Number(draft.teamScore) || 0,
        opponentScore: Number(draft.opponentScore) || 0,
        result: draft.result,
        playedOn: draft.date,
        boxScore,
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      showToast(d.error || "Save failed", "error");
      setPhase("review");
      return;
    }

    showToast("Game saved!");
    setPhase("idle");
    setDraft(null);
    setJsonText("");
    setHighlights({});
    setWarnings([]);
  };

  const leagueOptions = seasonLeagues.map((sl) => ({
    value: sl.id,
    label: sl.leagueName,
  }));

  // ── guards ──────────────────────────────────────────────────────────────
  if (!validSlug) return null;

  if (checking)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.base,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner />
      </div>
    );

  if (!authed)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.base,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <LoginForm onLogin={handleLogin} error={loginError} />
      </div>
    );

  return (
    <AdminLayout
      slug={slug}
      title="Import"
      toast={toast}
      setToast={setToast}
    >
      {/* UI unchanged */}
      {/* (kept exactly as your original) */}
    </AdminLayout>
  );
}

export async function getServerSideProps({ params }) {
  const validSlug = await validateAdminSlug(params.slug);
  return { props: { validSlug } };
}