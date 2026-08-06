import { clearSessionCookie, revokeAuthSession } from "../../_auth";

export async function POST(request: Request) {
  await revokeAuthSession(request.headers);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
}
