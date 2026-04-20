export function calcEff({
  pts=0, reb=0, ast=0, stl=0, blk=0,
  tov=0, fgm=0, fga=0, ftm=0, fta=0,
} = {}) {
  return Math.round(
    pts + reb + ast + stl + blk
    - (fga - fgm)
    - (fta - ftm)
    - tov
  );
}
