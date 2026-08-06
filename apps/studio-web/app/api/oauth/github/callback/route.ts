import { completeOAuth, jsonFrom } from "../../_shared";

type GitHubUser = { id: number; login: string; name: string | null; email: string | null; avatar_url: string | null };
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

export async function GET(request: Request) {
  return completeOAuth(request, "github", async (configuration, code) => {
    const token = await jsonFrom<{ access_token: string }>(await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: configuration.clientId, client_secret: configuration.clientSecret, code, redirect_uri: configuration.redirectUri }),
    }));
    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "Agent-Memory-Studio" };
    const profile = await jsonFrom<GitHubUser>(await fetch("https://api.github.com/user", { headers }));
    const emails = await jsonFrom<GitHubEmail[]>(await fetch("https://api.github.com/user/emails", { headers }));
    const verified = emails.filter((item) => item.verified);
    const email = verified.find((item) => item.email.toLowerCase() === profile.email?.toLowerCase())?.email
      || verified.find((item) => item.primary)?.email || verified[0]?.email || "";
    if (!email) throw new Error("GitHub did not return a verified email address");
    return { accountId: String(profile.id), email, name: profile.name || profile.login, avatarUrl: profile.avatar_url };
  });
}
