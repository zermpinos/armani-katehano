// Single import target for the player charts, so recharts lands in one async
// chunk instead of Turbopack splitting a second copy across the two boundaries.
export { SkillRadar } from "./SkillRadar";
export { GameLogPanel } from "./GameLogPanel";
