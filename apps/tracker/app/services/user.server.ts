import { prisma } from "../utils/db.server";

export async function generateNewApiKey(userId: string) {
  const newApiKey = crypto.randomUUID();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { apiKey: newApiKey }
  });

  try {
    // wsUrl biasanya point ke /internal/broadcast di env, kita ganti path-nya
    const wsUrl = process.env.WS_INTERNAL_URL 
      ? process.env.WS_INTERNAL_URL.replace('/broadcast', '/kick')
      : "http://localhost:8081/internal/kick";
      
    const internalKey = process.env.INTERNAL_API_KEY || "dev-internal-key-123";
    
    fetch(wsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalKey,
      },
      body: JSON.stringify({ userId }),
    }).catch((e) => console.error("Failed to kick zombie WS sessions:", e.message));
  } catch (e: any) {
    console.error("Failed to trigger WS kick:", e.message);
  }

  return user;
}
