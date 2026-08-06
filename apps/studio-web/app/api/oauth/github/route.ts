import { createOAuthState, providerConfiguration } from "../../_auth";
import { redirectWithCookie } from "../_shared";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  try {
    const configuration = await providerConfiguration("github", requestUrl.origin);
    const { state, cookie } = await createOAuthState("github", requestUrl.searchParams.get("return_to") || "/");
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", configuration.clientId);
    authorize.searchParams.set("redirect_uri", configuration.redirectUri);
    authorize.searchParams.set("scope", "read:user user:email");
    authorize.searchParams.set("state", state);
    return redirectWithCookie(authorize, cookie);
  } catch {
    return Response.redirect(new URL("/?auth_error=github_not_configured", requestUrl.origin), 302);
  }
}
