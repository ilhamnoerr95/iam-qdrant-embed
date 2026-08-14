"use client";

import { useState, useEffect, useCallback } from "react";

type DirEntry = {
  name: string;
  path: string;
  hasChildren: boolean;
  isIndexed: boolean;
  containsIndexed: boolean;
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
  const [currentIsIndexed, setCurrentIsIndexed] = useState(false);
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
        setCurrentIsIndexed(data.currentIsIndexed || false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border-default bg-bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h3 className="text-sm font-semibold">📂 Select Folder</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">✕</button>
        </div>

        {/* Current path */}
        <div className="border-b border-border-default px-5 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-text-primary">📍</span>
            <span className="truncate font-mono text-text-secondary">{currentPath}</span>
            {currentIsIndexed && (
              <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                Indexed
              </span>
            )}
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
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-bg-input ${
                      dir.isIndexed ? "text-emerald-400" : "text-text-primary"
                    }`}
                  >
                    <span>{dir.isIndexed ? "✅" : dir.containsIndexed ? "📁" : dir.hasChildren ? "📁" : "📂"}</span>
                    <span className="truncate">{dir.name}</span>
                    {dir.isIndexed && (
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                        Indexed
                      </span>
                    )}
                    {!dir.isIndexed && dir.containsIndexed && (
                      <span className="ml-auto shrink-0 text-[9px] text-text-muted">
                        contains indexed
                      </span>
                    )}
                  </button>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-default px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-xs text-text-secondary font-mono">{currentPath}</span>
            {currentIsIndexed && (
              <span className="shrink-0 text-[10px] text-emerald-400">✓ indexed</span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="rounded-lg border border-border-input px-4 py-2 text-sm text-text-secondary hover:bg-bg-input transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSelect(currentPath); onClose(); }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              Select This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
