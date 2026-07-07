import { prisma } from "../utils/db.server";
import type { Prisma } from "@prisma/client";

export async function getRules(userId: string) {
  return prisma.autoStopRule.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function saveRule(
  userId: string,
  data: {
    id?: string;
    name?: string;
    enabled?: boolean;
    conditions: Prisma.InputJsonValue;
  }
) {
  if (data.id) {
    return prisma.autoStopRule.update({
      where: { id: data.id, userId },
      data: {
        name: data.name,
        enabled: data.enabled,
        conditions: data.conditions,
      },
    });
  }
  return prisma.autoStopRule.create({
    data: {
      userId,
      name: data.name,
      enabled: data.enabled ?? true,
      conditions: data.conditions,
    },
  });
}

export async function deleteRule(ruleId: string, userId: string) {
  return prisma.autoStopRule.delete({
    where: { id: ruleId, userId },
  });
}

export async function replaceAllRules(
  userId: string,
  rules: { name?: string; enabled: boolean; conditions: Prisma.InputJsonValue }[]
) {
  await prisma.$transaction([
    prisma.autoStopRule.deleteMany({ where: { userId } }),
    ...rules.map((r) =>
      prisma.autoStopRule.create({
        data: {
          userId,
          name: r.name,
          enabled: r.enabled,
          conditions: r.conditions,
        },
      })
    ),
  ]);
}

export async function updateUserTimezone(userId: string, timezone: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { timezone },
  });
}
