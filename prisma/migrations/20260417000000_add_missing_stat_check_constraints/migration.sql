ALTER TABLE "PlayerGameStat"
  -- fg2 sub-components
  ADD CONSTRAINT chk_fg2        CHECK (fg2m <= fg2a),
  ADD CONSTRAINT chk_fg2_fg3_eq_fg CHECK (fg2m + fg3m = fgm),
  -- rebound parts
  ADD CONSTRAINT chk_reb_parts  CHECK (orb + drb <= reb),
  -- non-negative: counting stats (plusMinus excluded -- can be negative)
  ADD CONSTRAINT chk_nn_minutes CHECK (minutes >= 0),
  ADD CONSTRAINT chk_nn_pts     CHECK (pts     >= 0),
  ADD CONSTRAINT chk_nn_reb     CHECK (reb     >= 0),
  ADD CONSTRAINT chk_nn_ast     CHECK (ast     >= 0),
  ADD CONSTRAINT chk_nn_stl     CHECK (stl     >= 0),
  ADD CONSTRAINT chk_nn_blk     CHECK (blk     >= 0),
  ADD CONSTRAINT chk_nn_tov     CHECK (tov     >= 0),
  ADD CONSTRAINT chk_nn_pf      CHECK (pf      >= 0),
  ADD CONSTRAINT chk_nn_fgm     CHECK (fgm     >= 0),
  ADD CONSTRAINT chk_nn_fga     CHECK (fga     >= 0),
  ADD CONSTRAINT chk_nn_fg3m    CHECK (fg3m    >= 0),
  ADD CONSTRAINT chk_nn_fg3a    CHECK (fg3a    >= 0),
  ADD CONSTRAINT chk_nn_ftm     CHECK (ftm     >= 0),
  ADD CONSTRAINT chk_nn_fta     CHECK (fta     >= 0),
  ADD CONSTRAINT chk_nn_orb     CHECK (orb     >= 0),
  ADD CONSTRAINT chk_nn_drb     CHECK (drb     >= 0),
  ADD CONSTRAINT chk_nn_fg2m    CHECK (fg2m    >= 0),
  ADD CONSTRAINT chk_nn_fg2a    CHECK (fg2a    >= 0);
