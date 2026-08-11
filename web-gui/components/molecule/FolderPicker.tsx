"use client";

import { useEmbedStore } from "@/store/useEmbedStore";
import { useCallback, useEffect, useRef, useState } from "react";
import FolderBrowser from "./FolderBrowser";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

const allExtensions = [
  ".txt", ".md", ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs",
  ".html", ".css", ".json", ".yaml", ".yml", ".sql", ".sh", ".c", ".cpp", ".rb", ".php", ".swift", ".kt",
];

export default function FolderPicker() {
  const {
    folderPath, extensions, includeSubfolders,
    totalFiles, totalSize, estimatedChunks, chunkSize,
    setFolderPath, setExtensions, setIncludeSubfolders, setScanStats,
  } = useEmbedStore();

  const [browserOpen, setBrowserOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const scanFolder = useCallback(async () => {
    if (!folderPath) return;
    try {
      const resp = await fetch("/api/scan-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath, extensions, includeSubfolders, chunkSize }),
      });
      const data = await resp.json();
      if (data.success) {
        setScanStats({
          totalFiles: data.totalFiles,
          totalSize: data.totalSize,
          estimatedChunks: data.estimatedChunks,
        });
      }
    } catch { /* ignore */ }
  }, [folderPath, extensions, includeSubfolders, chunkSize, setScanStats]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(scanFolder, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [scanFolder]);

  const removeExt = (ext: string) => {
    setExtensions(extensions.filter((e) => e !== ext));
  };

  const addExt = (ext: string) => {
    if (ext && !extensions.includes(ext)) {
      setExtensions([...extensions, ext]);
    }
  };

  const handleFolderSelect = (path: string) => {
    setFolderPath(path);
  };

  const availableExts = allExtensions.filter((e) => !extensions.includes(e));

  return (
    <div className="rounded-xl border border-border-default bg-bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">📂 Pilih Folder / Data</div>

      {/* Folder Path with Browse button */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs text-text-secondary">Folder Path</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/path/to/your/project"
            className="flex-1 rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
          />
          <button
            onClick={() => setBrowserOpen(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
          >
            📁 Browse
          </button>
        </div>
        <p className="mt-1 text-[11px] text-text-muted">Pilih folder yang berisi dokumen untuk di-embed</p>
      </div>

      {/* Extensions */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs text-text-secondary">File Extensions</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {extensions.map((ext) => (
            <span key={ext} className="flex items-center gap-1 rounded-md border border-border-input bg-bg-input px-2.5 py-1 text-xs text-text-primary">
              {ext}
              <span onClick={() => removeExt(ext)} className="cursor-pointer text-text-secondary hover:text-danger">×</span>
            </span>
          ))}
        </div>
        {availableExts.length > 0 && (
          <select
            onChange={(e) => { addExt(e.target.value); e.target.value = ""; }}
            defaultValue=""
            className="w-full cursor-pointer rounded-lg border border-border-input bg-bg-input px-3 py-2 text-xs text-text-secondary outline-none focus:border-accent"
          >
            <option value="">+ Add extension...</option>
            {availableExts.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        )}
      </div>

      {/* Include Subfolders */}
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeSubfolders}
          onChange={(e) => setIncludeSubfolders(e.target.checked)}
          className="accent-accent"
        />
        Include Subfolders
      </label>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border-input bg-bg-input p-2.5 text-center">
          <div className="text-lg font-bold text-accent">{totalFiles}</div>
          <div className="text-[11px] text-text-secondary">Total Files</div>
        </div>
        <div className="rounded-lg border border-border-input bg-bg-input p-2.5 text-center">
          <div className="text-lg font-bold text-accent">{formatSize(totalSize)}</div>
          <div className="text-[11px] text-text-secondary">Total Size</div>
        </div>
        <div className="rounded-lg border border-border-input bg-bg-input p-2.5 text-center">
          <div className="text-lg font-bold text-accent">~{estimatedChunks}</div>
          <div className="text-[11px] text-text-secondary">Est. Chunks</div>
        </div>
      </div>

      {/* Folder Browser Modal */}
      <FolderBrowser
        isOpen={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleFolderSelect}
        initialPath={folderPath || undefined}
      />
    </div>
  );
}
