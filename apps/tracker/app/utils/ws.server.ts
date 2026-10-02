// WS_INTERNAL_URL points at the ws service's /internal/broadcast endpoint; other internal endpoints share its origin.
function internalUrl(path: string) {
  const broadcastUrl = process.env.WS_INTERNAL_URL || "http://localhost:8081/internal/broadcast";
  return new URL(path, broadcastUrl).toString();
}

export async function callWsInternal<T>(path: string, body: object): Promise<T> {
  const res = await fetch(internalUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY || "dev-internal-key-123",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ws ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
