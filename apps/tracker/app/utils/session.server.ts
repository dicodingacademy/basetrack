import { createCookieSessionStorage } from "react-router";
import { prisma } from "./db.server";

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export async function getUserFromSessionId(sessionId: string | null) {
  if (!sessionId) return null;
  const dbSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  return dbSession?.user || null;
}
