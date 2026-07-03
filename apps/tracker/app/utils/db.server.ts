import { PrismaClient } from "db";

let prisma: PrismaClient;

declare global {
  var __db__: PrismaClient | undefined;
}

// Ensure the Prisma instance is cached in development to avoid connection exhaustion
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  prisma = global.__db__;
  prisma.$connect();
}

export { prisma };
