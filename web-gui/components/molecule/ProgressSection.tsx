"use client";

import { useEmbedStore } from "@/store/useEmbedStore";
import { useEffect, useRef } from "react";
import { showToast } from "@/components/atom/Toast";

export default function ProgressSection() {
  const { progress, isRunning, setProgress, setIsRunning } = useEmbedStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const store = useEmbedStore();

  const startEmbedding = async () => {
    const collectionName =
      store.collectionMode === "new" ? store.newCollectionName : store.selectedCollection;

    if (!collectionName) { alert("Pilih atau masukkan nama collection"); return; }
    if (!store.folderPath) { alert("Masukkan folder path"); return; }
    if (!store.model) { alert("Pilih embedding model"); return; }
    if (!store.workspace) { alert("Masukkan nama workspace"); return; }

    const body = {
      qdrantUrl: store.qdrantUrl,
      ollamaUrl: store.ollamaUrl,
      model: store.model,
      chunkSize: store.chunkSize,
      chunkOverlap: store.chunkOverlap,
      collectionName,
      createNew: store.collectionMode === "new",
      vectorSize: store.vectorSize,
      folderPath: store.folderPath,
      sourceType: store.sourceType,
      includeSubfolders: store.includeSubfolders,
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
  };

  const prevStatusRef = useRef(progress.status);

  // Poll progress
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(async () => {
        try {
          const resp = await fetch("/api/progress");
          const data = await resp.json();
          setProgress(data);

          // Show toast on status change
          if (data.status !== prevStatusRef.current) {
            if (data.status === "completed") {
              showToast("success", "Embedding selesai!", `${data.totalFiles} file berhasil di-embed.`);
            } else if (data.status === "error") {
              showToast("error", "Embedding gagal", data.errors?.[data.errors.length - 1] || "Unknown error");
            } else if (data.status === "stopped") {
              showToast("warning", "Embedding dihentikan", `${data.processedFiles}/${data.totalFiles} files processed.`);
            }
            prevStatusRef.current = data.status;
          }

          // Show toast for new errors during embedding
          if (data.errors?.length > 0 && data.status === "embedding") {
            const errorCount = data.errors.length;
            const lastError = data.errors[errorCount - 1];
            // Only show once per error count milestone
            if (errorCount === 1 || errorCount % 5 === 0) {
              showToast("warning", `${errorCount} error(s)`, lastError?.split("/").pop() || lastError, 3000);
            }
          }

          if (["completed", "stopped", "error"].includes(data.status)) {
            setIsRunning(false);
          }
        } catch { /* ignore */ }
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, setProgress, setIsRunning]);

  const statusMessage = () => {
    switch (progress.status) {
      case "scanning": return "🔍 Scanning files...";
      case "creating_collection": return "📦 Creating collection...";
      case "embedding":
        return `⚡ Processing ${progress.processedFiles}/${progress.totalFiles} — ${progress.currentFile?.split("/").pop() || ""}`;
      case "completed": return `✅ Completed! ${progress.totalFiles} files processed.`;
      case "stopped": return "⏹ Stopped by user.";
      case "error": return "❌ Error occurred.";
      default: return "Idle — ready to start";
    }
  };

  return (
    <div className="w-full rounded-xl border border-border-default bg-bg-card p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">🚀 Proses Indexing</div>
      <p className="mb-4 text-[13px] text-text-secondary">
        Mulai proses embedding. File dibaca → chunk → embed via Ollama → simpan ke Qdrant.
      </p>

      {/* Buttons */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={startEmbedding}
          disabled={isRunning}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          ▶ Start Embedding
        </button>
        <button
          onClick={stopEmbedding}
          disabled={!isRunning}
          className="rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
        >
          ⏹ Stop
        </button>
        <button
          onClick={resetEmbedding}
          className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
        >
          ↺ Reset
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-bg-input">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-all duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-text-secondary">{statusMessage()}</span>
        <span className="text-sm font-semibold text-accent">{progress.percent}%</span>
      </div>

      {/* Errors */}
      {progress.errors.length > 0 && (
        <div className="mt-3 max-h-24 overflow-y-auto">
          {progress.errors.map((e, i) => (
            <div key={i} className="py-0.5 text-[11px] text-danger">⚠️ {e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
