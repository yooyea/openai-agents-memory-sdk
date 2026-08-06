import {
  clearStateCookie,
  consumeOAuthState,
  createAuthSession,
  oauthErrorRedirect,
  providerConfiguration,
  upsertOAuthUser,
  type OAuthProvider,
} from "../_auth";

export function redirectWithCookie(url: URL | string, cookies: string | string[]) {
  const headers = new Headers({ Location: String(url), "Cache-Control": "no-store" });
  for (const cookie of Array.isArray(cookies) ? cookies : [cookies]) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export async function completeOAuth(
  request: Request,
  provider: OAuthProvider,
  loadProfile: (configuration: Awaited<ReturnType<typeof providerConfiguration>>, code: string) => Promise<{
    accountId: string; email: string; name: string; avatarUrl?: string | null;
  }>,
) {
  const requestUrl = new URL(request.url);
  const configuration = await providerConfiguration(provider, requestUrl.origin);
  try {
    const code = requestUrl.searchParams.get("code") || "";
    const state = requestUrl.searchParams.get("state") || "";
    const returnTo = await consumeOAuthState(request.headers, provider, state);
    if (!code) throw new Error("OAuth authorization code is missing");
    const profile = await loadProfile(configuration, code);
    const user = await upsertOAuthUser({ provider, ...profile });
    const cookie = await createAuthSession(user.id);
    return redirectWithCookie(new URL(returnTo, configuration.baseUrl), [cookie, clearStateCookie()]);
  } catch {
    return redirectWithCookie(oauthErrorRedirect(configuration.baseUrl, `${provider}_failed`), clearStateCookie());
  }
}

export async function jsonFrom<T>(response: Response) {
  const payload = await response.json() as T & { error?: string; error_description?: string };
  if (!response.ok || payload.error) throw new Error(payload.error_description || payload.error || "OAuth request failed");
  return payload;
}
