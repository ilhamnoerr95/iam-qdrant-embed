"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEmbedStore } from "@/store/useEmbedStore";

type ProjectInfo = {
  name: string;
  chunks: number;
};

type WorkspaceInfo = {
  workspace: string;
  totalChunks: number;
  projects: ProjectInfo[];
};

type WorkspacePathInfo = {
  path: string;
  collection: string;
  last_indexed: string;
};

export default function IndexedWorkspaces() {
  const store = useEmbedStore();
  const { qdrantUrl, ollamaUrl, qdrantStatus, selectedCollection, collectionMode, newCollectionName, model, chunkSize, chunkOverlap, vectorSize, extensions, includeSubfolders } = store;

  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [workspacePaths, setWorkspacePaths] = useState<Record<string, WorkspacePathInfo>>({});
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);
  const [currentCollection, setCurrentCollection] = useState("");

  // Only use selectedCollection for loading (not newCollectionName which changes on every keystroke)
  const stableCollection = collectionMode === "existing" ? selectedCollection : "";

  // Load indexed workspaces from Qdrant
  const loadWorkspaces = useCallback(async (collection?: string) => {
    const coll = collection || stableCollection;
    if (qdrantStatus !== "connected" || !coll) return;
    setLoading(true);
    setCurrentCollection(coll);
    try {
      const resp = await fetch(
        `/api/indexed-workspaces?url=${encodeURIComponent(qdrantUrl)}&collection=${encodeURIComponent(coll)}`
      );
      const data = await resp.json();
      if (data.success) {
        setWorkspaces(data.workspaces);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [qdrantUrl, qdrantStatus, stableCollection]);

  // Load workspace paths from config
  const loadConfig = useCallback(async () => {
    try {
      const resp = await fetch("/api/config");
      const data = await resp.json();
      if (data.success && data.config?.workspace_paths) {
        setWorkspacePaths(data.config.workspace_paths);
      }
    } catch { /* ignore */ }
  }, []);

  // Only auto-load when existing collection changes (NOT on new collection typing)
  const prevCollRef = useRef(stableCollection);
  useEffect(() => {
    if (stableCollection && stableCollection !== prevCollRef.current) {
      prevCollRef.current = stableCollection;
      loadWorkspaces();
    }
  }, [stableCollection, loadWorkspaces]);

  // Initial load
  useEffect(() => {
    if (qdrantStatus === "connected" && stableCollection) {
      loadWorkspaces();
    }
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qdrantStatus]);

  // Derive active collection for re-index (can include new collection after it's created)
  const activeCollection = collectionMode === "new" ? newCollectionName : selectedCollection;

  // Re-index: auto-fill all fields and trigger embedding directly
  const handleReindex = async (ws: WorkspaceInfo) => {
    const pathInfo = workspacePaths[ws.workspace];

    if (!pathInfo?.path) {
      store.setWorkspace(ws.workspace);
      store.setFolderPath("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      alert(`Path untuk workspace "${ws.workspace}" belum tersimpan. Silakan pilih folder lalu Start Embedding.`);
      return;
    }

    if (!model) {
      alert("Pilih embedding model terlebih dahulu (connect Ollama)");
      return;
    }

    const confirmMsg = `Re-index workspace "${ws.workspace}"?\n\nPath: ${pathInfo.path}\nCollection: ${pathInfo.collection || activeCollection}\nModel: ${model}`;
    if (!confirm(confirmMsg)) return;

    setReindexing(ws.workspace);

    try {
      const body = {
        qdrantUrl,
        ollamaUrl,
        model,
        chunkSize,
        chunkOverlap,
        collectionName: pathInfo.collection || activeCollection,
        createNew: false,
        vectorSize,
        folderPath: pathInfo.path,
        extensions,
        includeSubfolders,
        workspace: ws.workspace,
        project: pathInfo.path.replace(/\/+$/, "").split("/").pop() || ws.workspace,
      };

      const resp = await fetch("/api/start-embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();

      if (data.success) {
        store.setIsRunning(true);
        store.setWorkspace(ws.workspace);
        store.setFolderPath(pathInfo.path);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setReindexing(null);
    }
  };

  if (qdrantStatus !== "connected") return null;
  if (workspaces.length === 0 && !loading) return null;

  return (
    <div className="mb-4 w-full rounded-xl border border-border-default bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          📚 Indexed Workspaces
          {currentCollection && <span className="text-xs font-normal text-text-muted">({currentCollection})</span>}
        </div>
        <button
          onClick={() => { loadWorkspaces(); loadConfig(); }}
          disabled={loading}
          className="rounded-lg border border-border-input px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {loading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-text-secondary">⏳ Scanning indexed workspaces...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaces.map((ws) => {
            const pathInfo = workspacePaths[ws.workspace];
            const isReindexing = reindexing === ws.workspace;

            return (
              <div
                key={ws.workspace}
                className="rounded-lg border border-border-input bg-bg-input p-4 transition-colors hover:border-accent/50"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">📂 {ws.workspace}</span>
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                    {ws.totalChunks.toLocaleString()} chunks
                  </span>
                </div>

                {pathInfo?.path && (
                  <div className="mb-2 truncate text-[10px] font-mono text-text-muted" title={pathInfo.path}>
                    📍 {pathInfo.path}
                  </div>
                )}
                {!pathInfo?.path && (
                  <div className="mb-2 text-[10px] text-danger/70">⚠️ Path belum tersimpan</div>
                )}

                <div className="mb-3 max-h-20 space-y-0.5 overflow-y-auto">
                  {ws.projects.slice(0, 6).map((proj) => (
                    <div key={proj.name} className="flex items-center justify-between text-xs">
                      <span className="truncate text-text-secondary">{proj.name}</span>
                      <span className="ml-2 text-text-muted">{proj.chunks}</span>
                    </div>
                  ))}
                  {ws.projects.length > 6 && (
                    <div className="text-[10px] text-text-muted">+{ws.projects.length - 6} more</div>
                  )}
                </div>

                {pathInfo?.last_indexed && (
                  <div className="mb-2 text-[10px] text-text-muted">
                    🕐 {new Date(pathInfo.last_indexed).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}

                <button
                  onClick={() => handleReindex(ws)}
                  disabled={isReindexing || store.isRunning}
                  className="w-full rounded-md border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                >
                  {isReindexing ? "⏳ Starting..." : "🔄 Re-index"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
