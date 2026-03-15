import { prisma } from "@/lib/prisma";

export async function findBlackouts() {
  return prisma.blackoutPeriod.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });
}
