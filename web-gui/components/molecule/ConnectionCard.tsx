"use client";

import { cn } from "@/utils/cn";
import { ConnectionStatus } from "@/store/useEmbedStore";

type Props = {
  title: string;
  icon: string;
  url: string;
  onUrlChange: (url: string) => void;
  status: ConnectionStatus;
  onTest: () => void;
};

export default function ConnectionCard({ title, icon, url, onUrlChange, status, onTest }: Props) {
  return (
    <div className="flex-1 rounded-xl border border-border-default bg-bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span>{icon}</span> {title}
      </div>
      <label className="mb-1.5 block text-xs text-text-secondary">URL</label>
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="flex-1 rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
        />
        <button
          onClick={onTest}
          disabled={status === "testing"}
          className="whitespace-nowrap rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {status === "testing" ? "Testing..." : "Test Connection"}
        </button>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const config = {
    idle: { class: "bg-text-muted/20 text-text-secondary", label: "● Not connected" },
    testing: { class: "bg-text-muted/20 text-text-secondary", label: "⏳ Testing..." },
    connected: { class: "bg-accent/20 text-accent", label: "● Connected" },
    failed: { class: "bg-danger/20 text-danger", label: "✕ Failed" },
  };

  const c = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", c.class)}>
      {c.label}
    </span>
  );
}
