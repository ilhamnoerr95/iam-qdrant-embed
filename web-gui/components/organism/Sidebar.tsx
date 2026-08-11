"use client";

import { cn } from "@/utils/cn";
import { useEmbedStore } from "@/store/useEmbedStore";

const navItems = [
  { icon: "📊", label: "Index / Embed", active: true },
  { icon: "🔍", label: "Search", active: false },
  { icon: "📁", label: "Collections", active: false },
  { icon: "⚙️", label: "Settings", active: false },
];

export default function Sidebar() {
  const qdrantStatus = useEmbedStore((s) => s.qdrantStatus);
  const ollamaStatus = useEmbedStore((s) => s.ollamaStatus);

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-border-default bg-bg-sidebar px-4 py-6">
      {/* Logo */}
      <div className="mb-1 text-lg font-bold text-accent">⚡ Embed to Qdrant</div>
      <div className="mb-8 text-[11px] text-text-secondary">Local AI • Vector Search</div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
              item.active
                ? "border-l-[3px] border-accent bg-bg-card text-text-primary"
                : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="mt-auto border-t border-border-default pt-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
          <span className={cn("h-2 w-2 rounded-full", qdrantStatus === "connected" ? "bg-accent" : "bg-text-muted")} />
          Qdrant
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs text-text-secondary">
          <span className={cn("h-2 w-2 rounded-full", ollamaStatus === "connected" ? "bg-accent" : "bg-text-muted")} />
          Ollama
        </div>
        <div className="text-[11px] text-text-muted">v1.0.0</div>
      </div>
    </aside>
  );
}
