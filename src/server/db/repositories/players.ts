import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

export async function getPlayers() {
  const players = await prisma.player.findMany({
    orderBy: { number: "asc" },
  });
  return players.map(p => ({
    id:       p.id,
    slug:     p.slug,
    number:   p.number,
    name:     p.name,
    position: p.position,
    height:   p.height ?? "",
    weight:   p.weight ?? "",
    photoUrl: p.photoUrl ?? null,
    isActive: p.isActive,
  }));
}
