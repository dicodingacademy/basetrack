import type { ActionFunctionArgs } from "react-router";
import { revokeExtensionToken } from "../services/extension-auth.server";
import { extJson, preflightLoader, requireExtensionUser } from "../utils/ext-api.server";

export const loader = preflightLoader;

export async function action({ request }: ActionFunctionArgs) {
  const { user, tokenId } = await requireExtensionUser(request);
  await revokeExtensionToken(user.id, tokenId);
  return extJson({ ok: true });
}
