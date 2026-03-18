ALTER TABLE "PlayerGameStat"
  ADD CONSTRAINT chk_fg  CHECK (fgm <= fga),
  ADD CONSTRAINT chk_tp  CHECK (tpm <= tpa),
  ADD CONSTRAINT chk_ft  CHECK (ftm <= fta),
  ADD CONSTRAINT chk_tp_fg CHECK (tpm <= fgm);
