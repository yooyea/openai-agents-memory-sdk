import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <div className="page">
      <PageHeader eyebrow="Workspace" title="设置" description="管理模型提供方、数据库连接、运行环境和工作空间成员。" />
      <div className="editor-main">
        <div className="editor-content">
          <div className="form-stack">
            <label className="field"><span>工作空间名称</span><input defaultValue="Mai Ning Workspace" /></label>
            <label className="field"><span>默认模型提供方</span><select defaultValue="openai"><option value="openai">OpenAI</option><option value="compatible">OpenAI-compatible</option></select></label>
            <div className="info-box"><div><strong>后端尚未接入</strong><p>当前站点使用 Mock 数据。Control API 与 Runtime API 接入后，这里将管理真实环境配置。</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
