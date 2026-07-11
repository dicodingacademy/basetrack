import { registry } from "./registry";
import { tokenService } from "../services/token.service.server";

export async function getValidToken(userId: string, provider: string): Promise<string> {
  const token = await tokenService.getToken(userId, provider);
  if (!token) throw new Error(`${provider} not connected`);

  const BUFFER_MS = 5 * 60 * 1000;
  if (token.expiresAt.getTime() < Date.now() + BUFFER_MS) {
    if (!token.refreshToken) throw new Error(`${provider} token expired, no refresh token`);
    const p = registry[provider];
    const fresh = await p.refreshAccessToken(token.refreshToken);
    await tokenService.updateAccessToken(userId, provider, fresh);
    return fresh.accessToken;
  }

  return token.accessToken;
}

export async function disconnectProvider(userId: string, provider: string): Promise<void> {
  const token = await tokenService.getToken(userId, provider);
  if (!token) return;
  try {
    const p = registry[provider];
    if (p.revokeToken) await p.revokeToken(token.accessToken);
  } catch {
    // best-effort revoke
  }
  await tokenService.deleteToken(userId, provider);
}

export async function getConnectedProviders(userId: string): Promise<string[]> {
  return tokenService.getConnectedProviders(userId);
}
