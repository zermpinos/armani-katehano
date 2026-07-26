// The source publishes team names in caps, often in Greek; the site shows them
// the way a reader expects. The first 24 were generated from games already
// imported, so they reproduce decisions already made rather than inventing a
// convention; the rest are teams on the fixture list we have not played yet. No
// mechanical rule gets from "TAZ BOYS" to "Taz Boyz" or "S.H.A.W." to "Shaw",
// so the mapping is explicit and a name that is not in it is not guessed at.
const OPPONENT_NAMES: Record<string, string> = {
  "ΑΣΠΡΟΜΑΥΡΑ ΥΠΟΒΡΥΧΙΑ":  "Aspromavra Ipovrichia",
  "ΓΕΡΟΛΥΚΟΙ B.C.":        "Gerolykoi",
  "ΛΑΛΑΔΕΣ BC":            "Lalades BC",
  "ΡΕΝΤΑΚΗΔΕΣ":            "Rentakides",
  "ΣΚΙΛΛΟΥΝΤΙΑ":           "Skillountia",
  "ΦΟΝΙΚΕΣ ΤΡΟΜΠΕΤΕΣ":     "Fonikes Trompetes",
  "ΧΛΑΤΣΕΡΣ LEGENDS":      "Xlatsers Legends",
  "AIRBALL WIZARDS":       "Airball Wizards",
  "AIRBALLS":              "Airballs",
  "B.C. ABLA":             "B.C. Abla",
  "BLACKOUTS B.A.M.C.":    "Blackouts BAMC",
  "CAPPUCCINO KNIGHTS":    "Cappuccino Knights",
  "CUBA LIBRE":            "Cuba Libre",
  "DRAGONS":               "Dragons",
  "EAZY TIGERS":           "Eazy Tigers",
  "FAST BAKERS":           "Fast Bakers",
  "GEROLEAGUE STARS":      "Geroleague Stars",
  "HUSTLING HUSKIES":      "Hustling Huskies",
  "MIAMI BRICKS":          "Miami Bricks",
  "PATISSIA THUNDERS":     "Patissia Thunders",
  "PORT WARRIORS":         "Port Warriors",
  "PTOMA HAWKS":           "Ptoma Hawks",
  "RED HAWKS":             "Red Hawks",
  "S.H.A.W.":              "Shaw",
  "SAPIENS":               "Sapiens",
  "SHARKS":                "Sharks",
  "TAZ BOYS":              "Taz Boyz",
  "THE 90`s":              "The 90s",
  "THEMISTOKLIO THUNDERS": "Themistoklio Thunders",
  "TRANSPORTERS":          "Transporters",
  "VROMIKOMETA":           "Vromikometa",
  "WUHAN SURVIVORS":       "Wuhan Survivors",
};

function key(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

const BY_KEY = new Map(Object.entries(OPPONENT_NAMES).map(([k, v]) => [key(k), v]));

// null rather than the input, so a caller can tell a known name from a guess.
export function displayOpponent(scraped: string | null | undefined): string | null {
  if (!scraped) return null;
  return BY_KEY.get(key(scraped)) ?? null;
}
