import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

const KEY = "maintenance_mode";

export async function getMaintenanceFlag(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  return row?.value === "on";
}

export async function setMaintenanceFlag(enabled: boolean): Promise<void> {
  const value = enabled ? "on" : "off";
  await prisma.setting.upsert({
    where:  { key: KEY },
    update: { value },
    create: { key: KEY, value },
  });
}
