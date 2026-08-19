"use client";

import { useEmbedStore } from "@/store/useEmbedStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@/components/atom/Toast";
import FolderBrowser from "./FolderBrowser";

type LogEntry = {
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function FolderPicker() {
  const store = useEmbedStore();
  const {
    folderPath, includeSubfolders,
    totalFiles, totalSize, estimatedChunks, chunkSize,
    progress, isRunning,
    setFolderPath, setIncludeSubfolders, setScanStats,
    setProgress, setIsRunning,
  } = store;

  const [browserOpen, setBrowserOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const logCursorRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const prevStatusRef = useRef(progress.status);

  // Scan folder for stats + auto-detect source_type
  const scanFolder = useCallback(async () => {
    if (!folderPath) return;
    try {
      const resp = await fetch("/api/scan-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath, includeSubfolders, chunkSize }),
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
  }, [folderPath, includeSubfolders, chunkSize, setScanStats]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(scanFolder, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [scanFolder]);

  // Poll progress + logs when running
  useEffect(() => {
    if (isRunning) {
      setShowLogs(true);

      const poll = async () => {
        try {
          // Poll progress
          const progressResp = await fetch("/api/progress");
          const progressData = await progressResp.json();
          setProgress(progressData);

          // Poll logs (always fetch, even after completed)
          const logsResp = await fetch(`/api/logs?since=${logCursorRef.current}`);
          const logsData = await logsResp.json();
          if (logsData.logs?.length > 0) {
            setLogs((prev) => [...prev, ...logsData.logs]);
            logCursorRef.current = logsData.cursor;
          }

          // Toast on status change
          if (progressData.status !== prevStatusRef.current) {
            if (progressData.status === "completed") {
              showToast("success", "Embedding selesai!", `${progressData.totalFiles} file berhasil di-embed.`);
              store.triggerRefresh();
            } else if (progressData.status === "error") {
              showToast("error", "Embedding gagal", progressData.errors?.[progressData.errors.length - 1] || "Unknown error");
            } else if (progressData.status === "stopped") {
              showToast("warning", "Embedding dihentikan", `${progressData.processedFiles}/${progressData.totalFiles} files processed.`);
            }
            prevStatusRef.current = progressData.status;
          }

          // Stop polling only AFTER we've fetched final logs
          if (["completed", "stopped", "error"].includes(progressData.status)) {
            setIsRunning(false);
          }
        } catch { /* ignore */ }
      };

      // Immediate first poll (don't wait 300ms)
      poll();
      // Then poll every 300ms
      pollRef.current = setInterval(poll, 300);
    } else {
      // When isRunning becomes false, do one final log fetch then clear
      if (pollRef.current) {
        clearInterval(pollRef.current);
        // Final fetch to get any remaining logs
        (async () => {
          try {
            const logsResp = await fetch(`/api/logs?since=${logCursorRef.current}`);
            const logsData = await logsResp.json();
            if (logsData.logs?.length > 0) {
              setLogs((prev) => [...prev, ...logsData.logs]);
              logCursorRef.current = logsData.cursor;
            }
          } catch { /* ignore */ }
        })();
      }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, setProgress, setIsRunning]);

  // Track if user scrolled up (away from bottom)
  const handleLogsScroll = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return;
    // Consider "at bottom" if within 40px of the bottom edge
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    isUserScrolledUpRef.current = !atBottom;
    setShowScrollBtn(!atBottom);
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    isUserScrolledUpRef.current = false;
    setShowScrollBtn(false);
  }, []);

  // Auto-scroll logs only when user is at bottom (not scrolled up)
  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Start embedding
  const startEmbedding = async () => {
    const collectionName =
      store.collectionMode === "new" ? store.newCollectionName : store.selectedCollection;

    if (!collectionName) { alert("Pilih atau masukkan nama collection"); return; }
    if (!folderPath) { alert("Masukkan folder path"); return; }
    if (!store.model) { alert("Pilih embedding model"); return; }
    if (!store.workspace) { alert("Masukkan nama workspace"); return; }

    // Clear logs for new run
    setLogs([]);
    logCursorRef.current = 0;
    prevStatusRef.current = "idle";

    const body = {
      qdrantUrl: store.qdrantUrl,
      ollamaUrl: store.ollamaUrl,
      model: store.model,
      chunkSize: store.chunkSize,
      chunkOverlap: store.chunkOverlap,
      collectionName,
      createNew: store.collectionMode === "new",
      vectorSize: store.vectorSize,
      folderPath,
      includeSubfolders,
      workspace: store.workspace,
      project: store.project,
    };

    try {
      const resp = await fetch("/api/start-embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data.success) {
        setShowLogs(true);
        setIsRunning(true);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  };

  const stopEmbedding = async () => {
    await fetch("/api/stop-embedding", { method: "POST" });
    setIsRunning(false);
  };

  const resetEmbedding = async () => {
    await fetch("/api/reset", { method: "POST" });
    setIsRunning(false);
    store.resetProgress();
    setLogs([]);
    logCursorRef.current = 0;
    setShowLogs(false);
  };

  const handleFolderSelect = (path: string) => {
    setFolderPath(path);
  };

  const statusLabel = () => {
    switch (progress.status) {
      case "scanning": return "Scanning files...";
      case "creating_collection": return "Creating collection...";
      case "embedding": return `${progress.processedFiles}/${progress.totalFiles} files`;
      case "completed": return "Completed";
      case "stopped": return "Stopped";
      case "error": return "Error";
      default: return "Ready";
    }
  };

  const logLevelColor = (level: LogEntry["level"]): string => {
    switch (level) {
      case "info": return "text-text-secondary";
      case "warn": return "text-yellow-400";
      case "error": return "text-red-400";
      case "success": return "text-emerald-400";
    }
  };

  const logLevelIcon = (level: LogEntry["level"]): string => {
    switch (level) {
      case "info": return "›";
      case "warn": return "⚠";
      case "error": return "✗";
      case "success": return "✓";
    }
  };

  const isActive = isRunning || ["completed", "stopped", "error"].includes(progress.status);

  return (
    <div className="rounded-xl border border-border-default bg-bg-card overflow-hidden">
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">📂 Pilih Folder & Index</div>

        {/* Folder Path with Browse button */}
        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs text-text-secondary">Folder Path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              disabled={isRunning}
              placeholder="/path/to/your/project"
              className="flex-1 rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-60"
            />
            <button
              onClick={() => setBrowserOpen(true)}
              disabled={isRunning}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              📁 Browse
            </button>
          </div>
        </div>

        {/* Include Subfolders */}
        <label className="mb-3.5 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeSubfolders}
            onChange={(e) => setIncludeSubfolders(e.target.checked)}
            disabled={isRunning}
            className="accent-accent"
          />
          Include Subfolders
        </label>

        {/* Stats + Detected Type row */}
        {folderPath && totalFiles > 0 && (
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-4 rounded-lg border border-border-input bg-bg-input px-3 py-2">
              <span className="text-xs"><span className="font-bold text-accent">{totalFiles}</span> <span className="text-text-muted">files</span></span>
              <span className="text-xs"><span className="font-bold text-accent">{formatSize(totalSize)}</span></span>
              <span className="text-xs"><span className="font-bold text-accent">~{estimatedChunks}</span> <span className="text-text-muted">chunks</span></span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium bg-accent/10 text-accent border border-accent/20">
              💻 Code + 📖 Docs
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={startEmbedding}
              disabled={!folderPath || !store.model || !store.workspace}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Indexing
            </button>
          ) : (
            <button
              onClick={stopEmbedding}
              className="flex items-center gap-2 rounded-lg border border-red-500 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop
            </button>
          )}
          {(progress.status === "completed" || progress.status === "stopped" || progress.status === "error") && (
            <button
              onClick={resetEmbedding}
              className="rounded-lg border border-border-input px-4 py-2.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              ↺ Reset
            </button>
          )}
          {logs.length > 0 && !showLogs && (
            <button
              onClick={() => setShowLogs(true)}
              className="ml-auto rounded-lg border border-border-input px-3 py-2 text-[11px] text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Show Logs ({logs.length})
            </button>
          )}
        </div>
      </div>

      {/* Inline Progress Bar — shows when active */}
      {isActive && (
        <div className="border-t border-border-default px-5 py-3 bg-bg-input/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-text-secondary">{statusLabel()}</span>
            <span className="text-xs font-bold text-accent">{progress.percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-input">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progress.status === "error" ? "bg-red-500" :
                progress.status === "completed" ? "bg-emerald-500" :
                "bg-gradient-to-r from-accent to-blue-400"
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {progress.currentFile && isRunning && (
            <p className="mt-1.5 truncate text-[10px] font-mono text-text-muted">
              {progress.currentFile.split("/").slice(-2).join("/")}
            </p>
          )}
        </div>
      )}

      {/* Terminal-style Logs */}
      {showLogs && logs.length > 0 && (
        <div className="border-t border-border-default">
          <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117]">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Indexing Logs</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">{logs.length} entries</span>
              <button
                onClick={() => setShowLogs(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </div>
          <div className="relative">
            <div
              ref={logsContainerRef}
              onScroll={handleLogsScroll}
              className="max-h-56 overflow-y-auto bg-[#0d1117] px-4 py-2 font-mono text-[11px] leading-5"
            >
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-2 ${logLevelColor(log.level)}`}>
                  <span className="shrink-0 text-text-muted/50">{formatTime(log.timestamp)}</span>
                  <span className="shrink-0 w-3 text-center">{logLevelIcon(log.level)}</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
            {/* Scroll to bottom button — appears when user scrolls up */}
            {showScrollBtn && isRunning && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-accent/90 px-3 py-1.5 text-[10px] font-medium text-white shadow-lg transition-all hover:bg-accent"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Latest
              </button>
            )}
          </div>
        </div>
      )}

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
