import { prisma } from "../utils/db.server";

type SaveTokenInput = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn: number;
};

type StoredToken = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
};

class TokenService {
  async saveToken(userId: string, provider: string, data: SaveTokenInput): Promise<void> {
    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        expiresAt: new Date(Date.now() + data.expiresIn * 1000),
      },
      update: {
        accessToken: data.accessToken,
        ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
        expiresAt: new Date(Date.now() + data.expiresIn * 1000),
      },
    });
  }

  async getToken(userId: string, provider: string): Promise<StoredToken | null> {
    return prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId, provider } },
      select: { accessToken: true, refreshToken: true, expiresAt: true },
    });
  }

  async updateAccessToken(
    userId: string,
    provider: string,
    data: { accessToken: string; refreshToken?: string; expiresIn: number }
  ): Promise<void> {
    await prisma.oAuthToken.update({
      where: { userId_provider: { userId, provider } },
      data: {
        accessToken: data.accessToken,
        expiresAt: new Date(Date.now() + data.expiresIn * 1000),
        ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
      },
    });
  }

  async deleteToken(userId: string, provider: string): Promise<void> {
    await prisma.oAuthToken.delete({
      where: { userId_provider: { userId, provider } },
    });
  }

  async getConnectedProviders(userId: string): Promise<string[]> {
    const tokens = await prisma.oAuthToken.findMany({
      where: { userId },
      select: { provider: true },
    });
    return tokens.map(t => t.provider);
  }
}

export const tokenService = new TokenService();
