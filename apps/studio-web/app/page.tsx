import { headers } from "next/headers";
import { getCurrentUser, providerStatus } from "./api/_auth";
import LoginScreen from "./login-screen";
import Studio from "./studio-v2";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams?: Promise<{ auth_error?: string }> }) {
  const requestHeaders = await headers();
  let providers = {
    baseUrl: "",
    github: { configured: false, callbackUrl: "" },
    google: { configured: false, callbackUrl: "" },
  };
  try { providers = await providerStatus(); } catch { /* Local artifact tests do not expose Worker runtime bindings. */ }
  const authEnabled = providers.github.configured || providers.google.configured;
  const user = await getCurrentUser(requestHeaders);
  if (authEnabled && !user) {
    return <LoginScreen providers={providers} errorCode={(await searchParams)?.auth_error || ""} />;
  }
  return (
    <Studio
      user={{
        name: user?.name || "Local builder",
        email: user?.email || "local@agent-memory.studio",
      }}
      authenticated={Boolean(user)}
      authEnabled={authEnabled}
    />
  );
}
