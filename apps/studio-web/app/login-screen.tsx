type ProviderState = { configured: boolean };

const messages: Record<string, string> = {
  github_failed: "GitHub 登录未完成，请重试。",
  google_failed: "Google 登录未完成，请重试。",
};

export default function LoginScreen({ providers, errorCode = "" }: {
  providers: { github: ProviderState; google: ProviderState };
  errorCode?: string;
}) {
  return <main className="login-page">
    <section className="login-hero">
      <div className="login-brand"><span className="logo-mark"><i /><i /><i /></span><span>Agent Memory<small>STUDIO</small></span></div>
      <div className="login-copy"><p>PRIVATE AGENT RUNTIME</p><h1>让每个智能体<br />记住正确的事。</h1><span>登录后，你的智能体、会话、长期记忆和运行记录都按账号隔离。OpenAI API Key 经 AES-256-GCM 加密后持久保存。</span></div>
      <div className="login-points"><span><b>01</b>OAuth 身份验证</span><span><b>02</b>独立 D1 工作区</span><span><b>03</b>加密密钥存储</span></div>
    </section>
    <section className="login-panel"><div className="login-card"><p>WELCOME BACK</p><h2>登录 Agent Memory Studio</h2><span>选择一个账号继续。我们不会保存 OAuth Provider 的访问令牌。</span>
      {errorCode ? <div className="login-error">{messages[errorCode] || "登录失败，请重试。"}</div> : null}
      <a className={`oauth-button github ${providers.github.configured ? "" : "disabled"}`} href={providers.github.configured ? "/api/oauth/github?return_to=/" : undefined}><b>GH</b><span>使用 GitHub 登录</span></a>
      <a className={`oauth-button google ${providers.google.configured ? "" : "disabled"}`} href={providers.google.configured ? "/api/oauth/google?return_to=/" : undefined}><b>G</b><span>使用 Google 登录</span></a>
      <small>登录即表示你同意由本站创建安全会话。会话 Cookie 使用 HttpOnly、Secure 和 SameSite=Lax。</small>
    </div></section>
  </main>;
}
