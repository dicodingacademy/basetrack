---
name: basetrack-add-provider
description: >
  Guides engineers through adding a new OAuth integration provider to Basetrack — the Basecamp time
  tracker app. Use this skill whenever someone asks to add a provider (GitHub, Jira, Notion, Linear,
  etc.), wants to know how integrations work in Basetrack, or asks "how do I add a new tab/source to
  the sidebar?". This skill contains the exact file paths, interfaces, and patterns — use it
  proactively rather than making engineers read the codebase themselves.
---

# Adding a New OAuth Provider to Basetrack

Basetrack's integration system is designed so that adding a new provider touches **exactly 3 files**:
one new provider file, one registry line, and one icon mapping. Auth routes, DB storage, token
refresh, and the UI sidebar are all generic — they don't need to change.

## How the system works

```
registry.ts          → maps provider ID ("github") to OAuthProvider instance
auth.$provider.tsx   → generic OAuth start route (already exists, no changes needed)
auth.$provider.callback.tsx → generic callback (already exists, no changes needed)
TokenService         → handles DB upsert/read/refresh for any provider
home.tsx loader      → iterates registry, fetches providerItems, builds sidebar tabs
```

When a user connects a provider, a row is inserted into `OAuthToken(userId, provider, ...)`. On each
page load, the loader calls each connected provider's `tab.fetchItems(accessToken)` and sends the
results to the client as `providerItems[tabId]`.

## The 3 files to change

### 1. Create `app/integrations/providers/<provider>.ts`

Implement the `OAuthProvider` interface. The Google provider is the canonical reference — read
`app/integrations/providers/google.ts` before writing a new one.

```ts
import type { OAuthProvider, ProviderTab, TokenResult, TrackableItem } from "../types";

async function fetchIssues(accessToken: string): Promise<TrackableItem[]> {
  // Call the provider's API, map results to TrackableItem[]
  // Each item needs at minimum: id, title, source, type
  return items;
}

export class GitHubProvider implements OAuthProvider {
  readonly id = "github";           // must match the registry key
  readonly label = "GitHub";
  readonly scopes = "Issues & Pull Requests";   // shown in Settings UI

  readonly tabs: ProviderTab[] = [
    { id: "issues",        label: "Issues",        iconName: "CircleDot",   fetchItems: fetchIssues },
    { id: "pull_requests", label: "Pull Requests",  iconName: "GitPullRequest", fetchItems: fetchPRs },
  ];

  assertConfig() {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new Error("Missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET");
    }
  }

  buildAuthUrl(state: string): string { ... }
  async exchangeCode(code: string): Promise<TokenResult> { ... }
  async refreshAccessToken(refreshToken: string): Promise<TokenResult> { ... }
  async revokeToken?(accessToken: string): Promise<void> { ... } // optional
}
```

#### TrackableItem fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | unique per item, used as timer todoId |
| `title` | yes | shown as the main label in the card |
| `source` | yes | string constant, e.g. `"GITHUB_ISSUES"` — passed through to `TimeEntry.source` |
| `type` | yes | `"issue"` \| `"pull_request"` \| `"task"` \| `"event"` — shown as badge |
| `timeLabel` | no | pre-formatted time string shown top-right of card: `"9:00 AM"`, `"Dec 15"`, `"—"` |
| `subtitle` | no | secondary line under title — repo name, list name, etc. |
| `url` | no | link for the card |
| `nativeProjectId` | no | if the item maps to a Basecamp project, set this to skip the project picker |
| `nativeProjectName` | no | display name for the native project |

Multi-type providers (e.g., GitHub Issues + PRs): define one `fetchItems` function per tab.
Each returns a flat `TrackableItem[]`. The `type` field differentiates them in the UI.

#### TokenResult

```ts
type TokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;  // seconds
};
```

If the provider doesn't issue refresh tokens (e.g., GitHub personal access tokens), omit
`refreshToken` and set a large `expiresIn`.

### 2. Register in `app/integrations/registry.ts`

```ts
import { GoogleProvider } from "./providers/google";
import { GitHubProvider } from "./providers/github";  // add this
import type { OAuthProvider } from "./types";

export const registry: Record<string, OAuthProvider> = {
  google: new GoogleProvider(),
  github: new GitHubProvider(),  // add this line
};
```

The key (`"github"`) becomes the URL segment (`/auth/github`, `/auth/github/callback`) and the
`provider` column in `OAuthToken`.

### 3. Add icon(s) to `TAB_ICONS` in `app/routes/home.tsx`

```ts
import { Calendar, ListTodo, CircleDot, GitPullRequest } from "lucide-react";

const TAB_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Calendar,
  ListTodo,
  CircleDot,      // add for GitHub issues
  GitPullRequest, // add for PRs
};
```

The `iconName` strings in `ProviderTab` must match keys in this map. Use Lucide icon names — browse
https://lucide.dev/icons to find the right one.

## Environment variables

Add to your `.env` (and deployment secrets):

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=http://localhost:5173/auth/github/callback
```

`assertConfig()` will throw at startup if any are missing, catching misconfigurations early.

## OAuth app setup (provider-specific)

Each provider has its own OAuth app registration flow. The callback URL is always:

```
https://<your-domain>/auth/<provider-id>/callback
```

For local dev: `http://localhost:5173/auth/github/callback`

## What does NOT need to change

- `app/routes/auth.$provider.tsx` — generic, handles any provider
- `app/routes/auth.$provider.callback.tsx` — uses `TokenService.saveToken()`, generic
- `app/services/token.service.server.ts` — generic CRUD for `OAuthToken`
- `app/integrations/token.server.ts` — `getValidToken` / `disconnectProvider` work for any provider
- `app/components/home/TrackableItemCard.tsx` — renders any `TrackableItem`
- `app/components/home/SettingsModal.tsx` — loops over `availableProviders` dynamically
- Prisma schema / database — `OAuthToken` table stores tokens for all providers

## Verification checklist

After adding the provider:

1. `assertConfig()` doesn't throw — all env vars are set
2. `/auth/<provider>` redirects to the provider's login page
3. Callback stores a row in `OAuthToken` (`prisma studio` or check DB directly)
4. Provider tab appears in the sidebar after connecting
5. Items load in the correct tab
6. Start timer works for an item (with or without `nativeProjectId`)
7. Disconnect removes the tab and the `OAuthToken` row

## Service layer note

Never call `prisma` directly in routes or business logic. Use `TokenService` for all token DB
operations:

```ts
import { tokenService } from "../services/token.service.server";

// ✓ correct
await tokenService.saveToken(userId, provider, tokenData);
const token = await tokenService.getToken(userId, provider);

// ✗ wrong — goes through the service instead
await prisma.oAuthToken.upsert(...);
```
