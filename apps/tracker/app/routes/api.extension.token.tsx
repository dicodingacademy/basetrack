import type { ActionFunctionArgs } from "react-router";
import { exchangeAuthCode } from "../services/extension-auth.server";
import { extError, extJson, preflightLoader } from "../utils/ext-api.server";

export const loader = preflightLoader;

export async function action({ request }: ActionFunctionArgs) {

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return extError(400, "invalid_request", "Body must be JSON");
  }

  const { grant_type, code, code_verifier, redirect_uri } = body;
  if (
    grant_type !== "authorization_code" ||
    typeof code !== "string" ||
    typeof code_verifier !== "string" ||
    typeof redirect_uri !== "string" ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(code_verifier)
  ) {
    return extError(400, "invalid_request", "grant_type, code, code_verifier and redirect_uri are required");
  }

  const result = await exchangeAuthCode({ code, codeVerifier: code_verifier, redirectUri: redirect_uri });
  if (!result) return extError(400, "invalid_grant", "Authorization code is invalid, expired or already used");

  return extJson({
    access_token: result.token,
    token_type: "Bearer",
    user: { name: result.user.name, email: result.user.email },
  });
}
