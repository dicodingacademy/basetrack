import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../utils/db.server";

const CODE_TTL_MS = 2 * 60 * 1000;
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

// Redirect URIs of the internally distributed builds (IDs pinned via manifest `key` / gecko id).
const DEFAULT_REDIRECT_URIS = [
  "https://eckbdmbimjfcecoklehepjbogmhnkooe.chromiumapp.org/",
  "https://b4edfe9ac7382a51c1341b4ba0fbdc6d85ff2b60.extensions.allizom.org/",
];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function allowedRedirectUris() {
  const fromEnv = process.env.EXTENSION_REDIRECT_URIS?.split(",").map(s => s.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_REDIRECT_URIS;
}

export type AuthorizeRequest = {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  clientName: string;
};

/** Validates /extension/authorize params. Redirect URIs must match the allowlist exactly, or a code could be sent to an attacker. */
export function parseAuthorizeRequest(params: URLSearchParams): AuthorizeRequest | { error: string } {
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";

  if (params.get("response_type") !== "code") return { error: "response_type must be \"code\"" };
  if (!allowedRedirectUris().includes(redirectUri)) return { error: "redirect_uri is not registered" };
  if (!state || state.length > 256) return { error: "state is required" };
  if (params.get("code_challenge_method") !== "S256") return { error: "code_challenge_method must be S256" };
  if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) return { error: "code_challenge is invalid" };

  const clientName = (params.get("client_name") || "Basetrack Extension").slice(0, 80);
  return { redirectUri, state, codeChallenge, clientName };
}

export async function createAuthCode(userId: string, req: AuthorizeRequest) {
  const code = randomBytes(32).toString("base64url");
  await prisma.extensionAuthCode.create({
    data: {
      codeHash: sha256(code),
      userId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      clientName: req.clientName,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/** Exchanges a code for a long-lived bearer token. The code is burned before PKCE is checked, so it can never be replayed. */
export async function exchangeAuthCode(input: { code: string; codeVerifier: string; redirectUri: string }) {
  const codeHash = sha256(input.code);
  const claimed = await prisma.extensionAuthCode.updateMany({
    where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const authCode = await prisma.extensionAuthCode.findUniqueOrThrow({
    where: { codeHash },
    include: { user: true },
  });

  const challenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
  if (authCode.redirectUri !== input.redirectUri || challenge !== authCode.codeChallenge) return null;

  const token = randomBytes(32).toString("base64url");
  await prisma.extensionToken.create({
    data: { tokenHash: sha256(token), userId: authCode.userId, name: authCode.clientName },
  });

  return { token, user: authCode.user };
}

export async function authenticateExtension(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;

  const record = await prisma.extensionToken.findUnique({
    where: { tokenHash: sha256(match[1]) },
    include: { user: true },
  });
  if (!record || record.revokedAt) return null;

  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await prisma.extensionToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  }

  return { tokenId: record.id, user: record.user };
}

export async function listExtensionTokens(userId: string) {
  return prisma.extensionToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeExtensionToken(userId: string, tokenId: string) {
  await prisma.extensionToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
