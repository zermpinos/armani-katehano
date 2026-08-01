-- PlayerSeasonAggregate: add exact season-total foul count.
-- Fouls were previously average-only (pfAvg); this mirrors the existing
-- ptsTotal/rebTotal/astTotal/stlTotal pattern so Total Fouls can be an exact
-- sum instead of round(pfAvg * gp).
ALTER TABLE "PlayerSeasonAggregate" ADD COLUMN "pfTotal" INTEGER NOT NULL DEFAULT 0;
