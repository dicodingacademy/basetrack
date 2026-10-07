import { Form, useFetcher, redirect } from "react-router";
import type { Route } from "./+types/dashboard.clients";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { generateNewApiKey } from "../services/user.server";
import { listExtensionTokens, revokeExtensionToken } from "../services/extension-auth.server";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Puzzle, KeyRound, Loader2 } from "lucide-react";

export function meta() {
  return [{ title: "Basetrack - Clients" }];
}

function fmtDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return redirect("/auth/basecamp");

  return { apiKey: user.apiKey, tokens: await listExtensionTokens(user.id) };
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await getUserFromSessionId(session.get("sessionId"));
  if (!user) return redirect("/auth/basecamp");

  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "GENERATE_API_KEY") await generateNewApiKey(user.id);
  if (intent === "REVOKE_EXTENSION") {
    const tokenId = form.get("tokenId") as string;
    if (tokenId) await revokeExtensionToken(user.id, tokenId);
  }
  return { ok: true };
}

export default function ClientsPage({ loaderData }: Route.ComponentProps) {
  const { apiKey, tokens } = loaderData;
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold mb-0.5">Connected clients</p>
        <p className="text-xs text-muted-foreground">
          Timers are started and stopped by these clients. Basetrack only monitors what they record.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Personal API key</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Used by the desktop app to authenticate over the timer socket. Treat it like a password.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={apiKey || "No key generated yet"} className="font-mono text-xs" />
          {apiKey && (
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(apiKey)}>
              Copy
            </Button>
          )}
        </div>
        <div className="mt-3">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="GENERATE_API_KEY" />
            <Button type="submit" variant="secondary" size="sm" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {apiKey ? "Regenerate key" : "Generate key"}
            </Button>
          </fetcher.Form>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Puzzle className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Browser extensions</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Extensions you have connected via the Basetrack consent page.
        </p>
        {tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">No extensions connected.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map(t => (
              <li key={t.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Puzzle className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Connected {fmtDate(t.createdAt)}
                    {t.lastUsedAt ? ` · last used ${fmtDate(t.lastUsedAt)}` : ""}
                  </p>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="REVOKE_EXTENSION" />
                  <input type="hidden" name="tokenId" value={t.id} />
                  <Button type="submit" variant="outline" size="sm" disabled={busy}>
                    Revoke
                  </Button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
