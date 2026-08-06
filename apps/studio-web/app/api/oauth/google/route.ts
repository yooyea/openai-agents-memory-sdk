import { createOAuthState, providerConfiguration } from "../../_auth";
import { redirectWithCookie } from "../_shared";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  try {
    const configuration = await providerConfiguration("google", requestUrl.origin);
    const { state, cookie } = await createOAuthState("google", requestUrl.searchParams.get("return_to") || "/");
    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.searchParams.set("client_id", configuration.clientId);
    authorize.searchParams.set("redirect_uri", configuration.redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "openid email profile");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("prompt", "select_account");
    return redirectWithCookie(authorize, cookie);
  } catch {
    return Response.redirect(new URL("/?auth_error=google_not_configured", requestUrl.origin), 302);
  }
}
