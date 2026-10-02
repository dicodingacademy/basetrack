import { Form, data, redirect, useNavigation } from "react-router";
import { ArrowLeftRight, Clock, FolderKanban, ShieldCheck, Puzzle } from "lucide-react";
import type { Route } from "./+types/extension.authorize";
import { getSession, getUserFromSessionId } from "../utils/session.server";
import { createAuthCode, parseAuthorizeRequest } from "../services/extension-auth.server";
import { Button } from "../components/ui/button";

const FORWARDED_PARAMS = ["response_type", "redirect_uri", "state", "code_challenge", "code_challenge_method", "client_name"];

export function meta() {
  return [{ title: "Connect extension · Basetrack" }];
}

async function getUser(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return getUserFromSessionId(session.get("sessionId") ?? null);
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const parsed = parseAuthorizeRequest(url.searchParams);
  // Never redirect to an unverified redirect_uri — show the error here instead.
  if ("error" in parsed) return data({ error: parsed.error, clientName: null, user: null, params: {} }, { status: 400 });

  const user = await getUser(request);
  if (!user) {
    return redirect(`/auth/basecamp?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const params = Object.fromEntries(FORWARDED_PARAMS.map(k => [k, url.searchParams.get(k) ?? ""]));
  return { error: null, clientName: parsed.clientName, user: { name: user.name, email: user.email }, params };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) params.set(key, String(form.get(key) ?? ""));

  const parsed = parseAuthorizeRequest(params);
  if ("error" in parsed) return data({ error: parsed.error }, { status: 400 });

  const user = await getUser(request);
  if (!user) return redirect(`/extension/authorize?${params}`);

  const target = new URL(parsed.redirectUri);
  target.searchParams.set("state", parsed.state);

  if (form.get("decision") === "allow") {
    target.searchParams.set("code", await createAuthCode(user.id, parsed));
  } else {
    target.searchParams.set("error", "access_denied");
  }

  return redirect(target.toString());
}

export default function ExtensionAuthorize({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  if (loaderData.error || !loaderData.user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center">
          <p className="text-sm font-semibold">Can't connect this extension</p>
          <p className="mt-2 text-xs text-muted-foreground">{loaderData.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">BT</div>
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
            <Puzzle className="size-5 text-muted-foreground" />
          </div>
        </div>

        <h1 className="mt-5 text-base font-semibold">{loaderData.clientName} wants to access your Basetrack</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{loaderData.user.name}</span> ({loaderData.user.email})
        </p>

        <ul className="mt-5 space-y-3 text-sm">
          <li className="flex gap-3">
            <Clock className="size-4 mt-0.5 shrink-0 text-primary" />
            <span>Start and stop timers for you</span>
          </li>
          <li className="flex gap-3">
            <FolderKanban className="size-4 mt-0.5 shrink-0 text-primary" />
            <span>See your running timer and Basecamp projects</span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="size-4 mt-0.5 shrink-0 text-primary" />
            <span>You can revoke access anytime from Settings</span>
          </li>
        </ul>

        <Form method="post" className="mt-6 flex gap-2">
          {Object.entries(loaderData.params).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1" disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" name="decision" value="allow" className="flex-1" disabled={busy}>
            Allow access
          </Button>
        </Form>
      </div>
    </main>
  );
}
