import { AuthenticationError, deleteOpenAIKey, openAIKeyStatus, requireUser, saveOpenAIKey } from "../../_auth";
import { jsonError } from "../../_lib";

function failure(error: unknown) {
  return jsonError(error, error instanceof AuthenticationError ? 401 : 400);
}

export async function GET(request: Request) {
  try { return Response.json(await openAIKeyStatus((await requireUser(request)).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json() as { apiKey?: string };
    await saveOpenAIKey(user.id, String(body.apiKey || ""));
    return Response.json(await openAIKeyStatus(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    await deleteOpenAIKey(user.id);
    return Response.json({ configured: false, masked: "", updatedAt: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
