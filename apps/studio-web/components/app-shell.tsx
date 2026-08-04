"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BotIcon, ChatIcon, GridIcon, PulseIcon, SettingsIcon, SparkIcon } from "./icons";

const nav = [
  { href: "/", label: "工作台", icon: GridIcon },
  { href: "/agents", label: "智能体", icon: BotIcon },
  { href: "/chat", label: "会话", icon: ChatIcon },
  { href: "/runs", label: "运行记录", icon: PulseIcon, disabled: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><SparkIcon /></div>
          <div>
            <strong>Agent Studio</strong>
            <span>Stateful agents</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="主导航">
          <p className="nav-caption">工作空间</p>
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return item.disabled ? (
              <div className="nav-item disabled" key={item.href}><Icon /><span>{item.label}</span><small>即将开放</small></div>
            ) : (
              <Link className={`nav-item ${active ? "active" : ""}`} href={item.href} key={item.href}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <Link className="nav-item" href="/settings"><SettingsIcon /><span>设置</span></Link>
        <div className="account-card">
          <div className="avatar">MN</div>
          <div><strong>Mai Ning</strong><span>Owner</span></div>
          <button aria-label="账户菜单">•••</button>
        </div>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
