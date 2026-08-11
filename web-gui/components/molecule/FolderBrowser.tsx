"use client";

import { useState, useEffect, useCallback } from "react";

type DirEntry = {
  name: string;
  path: string;
  hasChildren: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
};

export default function FolderBrowser({ isOpen, onClose, onSelect, initialPath }: Props) {
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError("");
    try {
      const url = path
        ? `/api/browse-folder?path=${encodeURIComponent(path)}`
        : "/api/browse-folder";
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.success) {
        setCurrentPath(data.currentPath);
        setParentPath(data.parentPath);
        setDirectories(data.directories);
      } else {
        setError(data.message || "Failed to browse");
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      browse(initialPath || undefined);
    }
  }, [isOpen, initialPath, browse]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border-default bg-bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h3 className="text-sm font-semibold">📂 Select Folder</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">✕</button>
        </div>

        {/* Current path */}
        <div className="border-b border-border-default px-5 py-2.5">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="font-medium text-text-primary">📍</span>
            <span className="truncate font-mono">{currentPath}</span>
          </div>
        </div>

        {/* Directory listing */}
        <div className="h-72 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">Loading...</div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-danger">{error}</div>
          ) : (
            <>
              {parentPath && (
                <button
                  onClick={() => browse(parentPath)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-input"
                >
                  <span>⬆️</span>
                  <span>..</span>
                </button>
              )}
              {directories.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-text-muted">
                  No subdirectories
                </div>
              ) : (
                directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => browse(dir.path)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-input"
                  >
                    <span>{dir.hasChildren ? "📁" : "📂"}</span>
                    <span className="truncate">{dir.name}</span>
                  </button>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-default px-5 py-3">
          <span className="truncate text-xs text-text-secondary font-mono">{currentPath}</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border-input px-4 py-2 text-sm text-text-secondary hover:bg-bg-input"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSelect(currentPath); onClose(); }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Select This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
