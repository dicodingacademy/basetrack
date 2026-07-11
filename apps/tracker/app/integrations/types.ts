export type TokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
};

export type TrackableItem = {
  id: string;
  title: string;
  timeLabel?: string;       // pre-formatted by provider: "9:00 AM", "Dec 15", "—"
  subtitle?: string;        // repo name, team name, task list name
  url?: string;
  tags?: string[];
  source: string;           // passed as-is to StartTimerData.source
  type: string;             // "event" | "task" | "issue" | "pull_request"
  nativeProjectId?: string;
  nativeProjectName?: string;
};

export type ProviderTab = {
  id: string;
  label: string;
  iconName: string;         // lucide icon name, looked up client-side
  fetchItems: (accessToken: string) => Promise<TrackableItem[]>;
};

export interface OAuthProvider {
  readonly id: string;
  readonly label: string;
  readonly scopes: string;
  assertConfig(): void;
  buildAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenResult>;
  refreshAccessToken(refreshToken: string): Promise<TokenResult>;
  revokeToken?(accessToken: string): Promise<void>;
  readonly tabs: ProviderTab[];
}
