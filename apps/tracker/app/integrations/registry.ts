import { GoogleProvider } from "./providers/google";
import type { OAuthProvider } from "./types";

export const registry: Record<string, OAuthProvider> = {
  google: new GoogleProvider(),
};
