import { completeOAuth, jsonFrom } from "../../_shared";

type GoogleProfile = { sub: string; email: string; email_verified?: boolean; name?: string; picture?: string };

export async function GET(request: Request) {
  return completeOAuth(request, "google", async (configuration, code) => {
    const token = await jsonFrom<{ access_token: string }>(await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: configuration.clientId, client_secret: configuration.clientSecret, code, grant_type: "authorization_code", redirect_uri: configuration.redirectUri }),
    }));
    const profile = await jsonFrom<GoogleProfile>(await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }));
    if (!profile.email || profile.email_verified === false) throw new Error("Google did not return a verified email address");
    return { accountId: profile.sub, email: profile.email, name: profile.name || profile.email, avatarUrl: profile.picture || null };
  });
}
