"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEmbedStore } from "@/store/useEmbedStore";
import FolderBrowser from "./FolderBrowser";

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

const PROJECTS_PER_PAGE = 5;

function WorkspaceCard({
  ws,
  pathInfo,
  collection,
  isReindexing,
  isRunning,
  onReindex,
  onDeleteProject,
  onAddProject,
  onDeleteWorkspace,
}: {
  ws: WorkspaceInfo;
  pathInfo?: WorkspacePathInfo;
  collection: string;
  isReindexing: boolean;
  isRunning: boolean;
  onReindex: () => void;
  onDeleteProject: (projectName: string) => void;
  onAddProject: (workspaceName: string, workspacePath: string) => void;
  onDeleteWorkspace: () => void;
}) {
  const [page, setPage] = useState(0);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const totalPages = Math.ceil(ws.projects.length / PROJECTS_PER_PAGE);
  const paginatedProjects = ws.projects.slice(
    page * PROJECTS_PER_PAGE,
    (page + 1) * PROJECTS_PER_PAGE
  );

  const handleDelete = async (projectName: string) => {
    setDeletingProject(projectName);
    await onDeleteProject(projectName);
    setDeletingProject(null);
  };

  return (
    <div className="rounded-xl border border-border-default bg-bg-card overflow-hidden transition-all hover:border-accent/30">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                {ws.workspace}
              </h3>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                ws.projects.length > 0
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
              }`}>
                {ws.projects.length > 0 ? `${ws.projects.length} Projects` : "Belum di-index"}
              </span>
              {collection && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M3 9h18M9 3v18" />
                  </svg>
                  {collection}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] font-mono text-text-muted" title={pathInfo?.path}>
              {pathInfo?.path || "Path belum tersimpan"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onReindex}
            disabled={isReindexing || isRunning}
            className="flex items-center gap-1.5 rounded-lg border border-accent/50 bg-accent/5 px-3.5 py-2 text-xs font-medium text-accent transition-all hover:bg-accent/15 hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {isReindexing ? "Starting..." : "Index Workspace"}
          </button>
          <button
            onClick={onDeleteWorkspace}
            disabled={isRunning}
            title="Delete workspace"
            className="rounded-lg border border-border-input p-2 text-text-muted transition-all hover:border-red-500 hover:text-red-400 hover:bg-red-500/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      </div>

      {/* Projects Section */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-text-secondary">Projects</span>
          {pathInfo?.path && (
            <button
              onClick={() => onAddProject(ws.workspace, pathInfo.path)}
              disabled={isRunning}
              className="flex items-center gap-1 text-[11px] font-medium text-accent transition-colors hover:text-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Tambah Project
            </button>
          )}
        </div>

        {ws.projects.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-muted">
            Belum ada project ter-index. Klik &quot;Index Workspace&quot; untuk scan.
          </div>
        ) : (
          <div className="space-y-0">
            {paginatedProjects.map((proj, idx) => (
              <div
                key={proj.name}
                className={`group flex items-center justify-between py-2.5 ${
                  idx < paginatedProjects.length - 1 ? "border-b border-border-default/50" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-text-muted">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-sm text-text-primary truncate">{proj.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                    Indexed ({proj.chunks.toLocaleString()})
                  </span>
                  {/* Re-index single project button */}
                  <button
                    onClick={() => onAddProject(ws.workspace, pathInfo?.path ? `${pathInfo.path}/${proj.name}` : "")}
                    disabled={isRunning || !pathInfo?.path}
                    title="Re-index project"
                    className="rounded-md border border-border-input p-1.5 text-text-muted transition-all hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {/* Delete project button */}
                  <button
                    onClick={() => handleDelete(proj.name)}
                    disabled={deletingProject === proj.name || isRunning}
                    title="Delete project from index"
                    className="rounded-md border border-border-input p-1.5 text-text-muted transition-all hover:border-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingProject === proj.name ? (
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border-default/50">
            <span className="text-[10px] text-text-muted">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-border-input px-2 py-1 text-[10px] text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md border border-border-input px-2 py-1 text-[10px] text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IndexedWorkspaces() {
  const store = useEmbedStore();
  const { qdrantUrl, ollamaUrl, qdrantStatus, selectedCollection, collectionMode, newCollectionName, model, chunkSize, chunkOverlap, vectorSize, sourceType, includeSubfolders, refreshTrigger } = store;

  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [workspacePaths, setWorkspacePaths] = useState<Record<string, WorkspacePathInfo>>({});
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentCollection, setCurrentCollection] = useState("");
  const [addProjectModal, setAddProjectModal] = useState<{ workspace: string; basePath: string } | null>(null);
  const [newProjectPath, setNewProjectPath] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [setPathModal, setSetPathModal] = useState<{ workspace: string; collection: string } | null>(null);
  const [setPathValue, setSetPathValue] = useState("");
  const [setPathBrowserOpen, setSetPathBrowserOpen] = useState(false);

  // Only use selectedCollection for loading (not newCollectionName which changes on every keystroke)
  const stableCollection = collectionMode === "existing" ? selectedCollection : "";

  // Load indexed workspaces from Qdrant — scans all relevant collections
  const loadWorkspaces = useCallback(async (collection?: string) => {
    if (qdrantStatus !== "connected") return;
    setLoading(true);

    const coll = collection || stableCollection;
    if (coll) setCurrentCollection(coll);

    try {
      // Fetch fresh config to get latest workspace_paths
      let freshWorkspacePaths: Record<string, WorkspacePathInfo> = workspacePaths;
      try {
        const configResp = await fetch("/api/config");
        const configData = await configResp.json();
        if (configData.success && configData.config?.workspace_paths) {
          freshWorkspacePaths = configData.config.workspace_paths;
          setWorkspacePaths(freshWorkspacePaths);
        }
      } catch { /* use current state */ }

      // Collect unique collections to scan: the selected one + all from workspace_paths
      const collectionsToScan = new Set<string>();
      if (coll) collectionsToScan.add(coll);

      for (const info of Object.values(freshWorkspacePaths)) {
        if (info.collection) collectionsToScan.add(info.collection);
      }

      // Filter out hidden collections
      const HIDDEN_COLLECTIONS = ["web"];
      for (const hidden of HIDDEN_COLLECTIONS) {
        collectionsToScan.delete(hidden);
      }

      // Merge results from all collections
      const allWorkspaces = new Map<string, WorkspaceInfo>();

      for (const collName of collectionsToScan) {
        try {
          const resp = await fetch(
            `/api/indexed-workspaces?url=${encodeURIComponent(qdrantUrl)}&collection=${encodeURIComponent(collName)}`
          );
          const data = await resp.json();
          if (data.success && data.workspaces) {
            for (const ws of data.workspaces as WorkspaceInfo[]) {
              const key = ws.workspace.toLowerCase();
              if (allWorkspaces.has(key)) {
                const existing = allWorkspaces.get(key)!;
                existing.totalChunks += ws.totalChunks;
                for (const proj of ws.projects) {
                  const existingProj = existing.projects.find((p) => p.name === proj.name);
                  if (existingProj) {
                    existingProj.chunks += proj.chunks;
                  } else {
                    existing.projects.push(proj);
                  }
                }
              } else {
                allWorkspaces.set(key, { ...ws });
              }
            }
          }
        } catch { /* skip this collection */ }
      }

      setWorkspaces(Array.from(allWorkspaces.values()).sort((a, b) => b.totalChunks - a.totalChunks));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [qdrantUrl, qdrantStatus, stableCollection, workspacePaths]);

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
  // Derive active collection
  const activeCollection = collectionMode === "new" ? newCollectionName : selectedCollection;

  const prevCollRef = useRef(stableCollection);
  useEffect(() => {
    if (stableCollection && stableCollection !== prevCollRef.current) {
      prevCollRef.current = stableCollection;
      loadWorkspaces();
    }
  }, [stableCollection, loadWorkspaces]);

  // Initial load
  useEffect(() => {
    if (qdrantStatus === "connected") {
      const coll = stableCollection || activeCollection;
      if (coll) loadWorkspaces(coll);
    }
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qdrantStatus]);

  // Auto-reload when embedding completes (refreshTrigger incremented)
  useEffect(() => {
    if (refreshTrigger > 0 && qdrantStatus === "connected") {
      const coll = stableCollection || activeCollection;
      loadWorkspaces(coll || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // Case-insensitive workspace path lookup
  const getWorkspacePath = (workspaceName: string): WorkspacePathInfo | undefined => {
    // Try exact match first
    if (workspacePaths[workspaceName]) return workspacePaths[workspaceName];
    // Try case-insensitive
    const key = Object.keys(workspacePaths).find(
      (k) => k.toLowerCase() === workspaceName.toLowerCase()
    );
    return key ? workspacePaths[key] : undefined;
  };

  // Re-index whole workspace — langsung jalan jika path sudah tersimpan
  const handleReindex = async (ws: WorkspaceInfo) => {
    const pathInfo = getWorkspacePath(ws.workspace);

    if (!pathInfo?.path) {
      // Open modal to set path instead of alert
      const coll = pathInfo?.collection || activeCollection;
      setSetPathModal({ workspace: ws.workspace, collection: coll });
      setSetPathValue("");
      return;
    }

    if (!model) {
      alert("Pilih embedding model terlebih dahulu (connect Ollama)");
      return;
    }

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
        sourceType,
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

  // Delete a project from index
  const handleDeleteProject = async (workspaceName: string, projectName: string) => {
    const coll = getWorkspacePath(workspaceName)?.collection || activeCollection;
    if (!coll) {
      alert("Collection tidak diketahui");
      return;
    }

    if (!confirm(`Hapus project "${projectName}" dari workspace "${workspaceName}"?\n\nSemua chunks akan dihapus dari Qdrant.`)) return;

    try {
      const resp = await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qdrantUrl,
          collection: coll,
          workspace: workspaceName,
          project: projectName,
        }),
      });
      const data = await resp.json();

      if (data.success) {
        // Reload workspaces
        await loadWorkspaces();
      } else {
        alert(data.message || "Gagal menghapus project");
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  };

  // Delete entire workspace (all projects)
  const handleDeleteWorkspace = async (ws: WorkspaceInfo) => {
    const coll = getWorkspacePath(ws.workspace)?.collection || activeCollection;
    if (!coll) {
      alert("Collection tidak diketahui");
      return;
    }

    const projectNames = ws.projects.map((p) => p.name).join(", ") || "(no projects)";
    if (!confirm(`Hapus seluruh workspace "${ws.workspace}"?\n\nSemua project (${projectNames}) dan ${ws.totalChunks.toLocaleString()} chunks akan dihapus dari Qdrant.\n\nAksi ini tidak bisa di-undo.`)) return;

    try {
      const resp = await fetch("/api/delete-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qdrantUrl,
          collection: coll,
          workspace: ws.workspace,
        }),
      });
      const data = await resp.json();

      if (data.success) {
        // Reload workspaces and config
        await loadWorkspaces();
        await loadConfig();
      } else {
        alert(data.message || "Gagal menghapus workspace");
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  };

  // Open add project modal
  const handleAddProject = (workspaceName: string, basePath: string) => {
    setAddProjectModal({ workspace: workspaceName, basePath });
    setNewProjectPath(basePath);
  };

  // Submit add project
  const submitAddProject = async () => {
    if (!addProjectModal || !newProjectPath) return;
    if (!model) {
      alert("Pilih embedding model terlebih dahulu");
      return;
    }

    const projectName = newProjectPath.replace(/\/+$/, "").split("/").pop() || "unknown";
    const coll = getWorkspacePath(addProjectModal.workspace)?.collection || activeCollection;

    if (!coll) {
      alert("Collection tidak diketahui");
      return;
    }

    try {
      const resp = await fetch("/api/add-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qdrantUrl,
          ollamaUrl,
          model,
          chunkSize,
          chunkOverlap,
          collectionName: coll,
          vectorSize,
          workspace: addProjectModal.workspace,
          projectPath: newProjectPath,
          projectName,
          sourceType,
        }),
      });
      const data = await resp.json();

      if (data.success) {
        store.setIsRunning(true);
        setAddProjectModal(null);
        setNewProjectPath("");
      } else {
        alert(data.message || "Gagal menambahkan project");
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown"));
    }
  };

  const handleBrowseSelect = (path: string) => {
    setNewProjectPath(path);
  };

  // Set path for workspace and immediately start indexing
  const submitSetPath = async () => {
    if (!setPathModal || !setPathValue) return;
    if (!model) {
      alert("Pilih embedding model terlebih dahulu");
      return;
    }

    const wsKey = setPathModal.workspace.toLowerCase();
    const coll = setPathModal.collection || activeCollection;

    // Save path to config
    try {
      const configResp = await fetch("/api/config");
      const configData = await configResp.json();
      if (configData.success) {
        const appConfig = configData.config;
        if (!appConfig.workspace_paths) appConfig.workspace_paths = {};
        appConfig.workspace_paths[wsKey] = {
          path: setPathValue,
          collection: coll,
          last_indexed: new Date().toISOString(),
        };
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appConfig),
        });
        // Update local state
        setWorkspacePaths((prev) => ({
          ...prev,
          [wsKey]: { path: setPathValue, collection: coll, last_indexed: new Date().toISOString() },
        }));
      }
    } catch { /* non-critical */ }

    // Start indexing
    setReindexing(setPathModal.workspace);
    try {
      const body = {
        qdrantUrl,
        ollamaUrl,
        model,
        chunkSize,
        chunkOverlap,
        collectionName: coll,
        createNew: false,
        vectorSize,
        folderPath: setPathValue,
        sourceType,
        includeSubfolders,
        workspace: setPathModal.workspace,
        project: setPathValue.replace(/\/+$/, "").split("/").pop() || setPathModal.workspace,
      };

      const resp = await fetch("/api/start-embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();

      if (data.success) {
        store.setIsRunning(true);
        store.setWorkspace(setPathModal.workspace);
        store.setFolderPath(setPathValue);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setReindexing(null);
      setSetPathModal(null);
      setSetPathValue("");
    }
  };

  if (qdrantStatus !== "connected") return null;

  // Hidden collections (web-scrape type — not managed in this UI)
  const HIDDEN_COLLECTIONS = ["web"];

  // Merge: workspaces from Qdrant + workspaces from config that aren't in Qdrant yet
  const mergedWorkspaces: WorkspaceInfo[] = [...workspaces];
  const qdrantWsNames = new Set(workspaces.map((ws) => ws.workspace.toLowerCase()));

  // Add workspaces from config that have a path but no data in Qdrant yet
  for (const [key, pathInfo] of Object.entries(workspacePaths)) {
    if (!qdrantWsNames.has(key.toLowerCase()) && pathInfo.path && !HIDDEN_COLLECTIONS.includes(pathInfo.collection)) {
      mergedWorkspaces.push({
        workspace: key,
        totalChunks: 0,
        projects: [],
      });
    }
  }

  if (mergedWorkspaces.length === 0 && !loading) return null;

  // Filter workspaces by search
  const filteredWorkspaces = searchQuery
    ? mergedWorkspaces.filter(
        (ws) =>
          ws.workspace.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ws.projects.some((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : mergedWorkspaces;

  // Summary stats
  const totalProjects = mergedWorkspaces.reduce((sum, ws) => sum + ws.projects.length, 0);
  const totalIndexedProjects = mergedWorkspaces.reduce((sum, ws) => sum + ws.projects.filter((p) => p.chunks > 0).length, 0);
  const totalChunks = mergedWorkspaces.reduce((sum, ws) => sum + ws.totalChunks, 0);

  return (
    <div className="w-full space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari workspace..."
          className="w-full rounded-xl border border-border-default bg-bg-card py-3 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-border-default bg-bg-card py-10 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Scanning indexed workspaces...
          </div>
        </div>
      )}

      {/* Workspace Cards */}
      {!loading && (
        <div className="space-y-4">
          {filteredWorkspaces.map((ws) => (
            <WorkspaceCard
              key={ws.workspace}
              ws={ws}
              pathInfo={getWorkspacePath(ws.workspace)}
              collection={getWorkspacePath(ws.workspace)?.collection || activeCollection}
              isReindexing={reindexing === ws.workspace}
              isRunning={store.isRunning}
              onReindex={() => handleReindex(ws)}
              onDeleteProject={(projectName) => handleDeleteProject(ws.workspace, projectName)}
              onAddProject={handleAddProject}
              onDeleteWorkspace={() => handleDeleteWorkspace(ws)}
            />
          ))}
          {filteredWorkspaces.length === 0 && searchQuery && (
            <div className="rounded-xl border border-border-default bg-bg-card py-8 text-center text-sm text-text-muted">
              Tidak ada workspace yang cocok dengan &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* Summary Stats Footer */}
      {!loading && workspaces.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border-default bg-bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">{workspaces.length}</div>
                <div className="text-[11px] text-text-muted">Workspaces</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-default bg-bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">{totalIndexedProjects} / {totalProjects}</div>
                <div className="text-[11px] text-text-muted">Projects</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-default bg-bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">{totalChunks.toLocaleString()}</div>
                <div className="text-[11px] text-text-muted">Chunks Indexed</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-default bg-bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary">Tips</div>
                <div className="text-[10px] text-text-muted leading-tight">
                  Index hanya project yang Anda butuhkan untuk hasil yang lebih relevan.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {addProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAddProjectModal(null)}>
          <div className="w-full max-w-md rounded-xl border border-border-default bg-bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-text-primary">Tambah Project</h3>
            <p className="mb-4 text-xs text-text-muted">
              Workspace: <span className="font-semibold text-accent">{addProjectModal.workspace}</span>
            </p>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs text-text-secondary">Project Folder Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  placeholder="/path/to/project-folder"
                  className="flex-1 rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                />
                <button
                  onClick={() => setBrowserOpen(true)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-accent px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  📁 Browse
                </button>
              </div>
              <p className="mt-1 text-[10px] text-text-muted">
                Pilih subfolder spesifik yang ingin di-index sebagai project baru
              </p>
            </div>

            {newProjectPath && (
              <div className="mb-4 rounded-lg border border-border-input bg-bg-input p-3">
                <div className="text-[10px] text-text-muted mb-1">Akan di-index sebagai:</div>
                <div className="text-xs text-text-primary font-mono">
                  {addProjectModal.workspace} / <span className="text-accent font-semibold">{newProjectPath.replace(/\/+$/, "").split("/").pop()}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setAddProjectModal(null); setNewProjectPath(""); }}
                className="rounded-lg border border-border-input px-4 py-2 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
              >
                Batal
              </button>
              <button
                onClick={submitAddProject}
                disabled={!newProjectPath || store.isRunning}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Index Project
              </button>
            </div>
          </div>

          {/* Folder Browser inside modal */}
          <FolderBrowser
            isOpen={browserOpen}
            onClose={() => setBrowserOpen(false)}
            onSelect={handleBrowseSelect}
            initialPath={addProjectModal.basePath || undefined}
          />
        </div>
      )}

      {/* Set Path Modal — when workspace has no path stored */}
      {setPathModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSetPathModal(null)}>
          <div className="w-full max-w-md rounded-xl border border-border-default bg-bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-text-primary">Set Folder Path</h3>
            <p className="mb-4 text-xs text-text-muted">
              Workspace <span className="font-semibold text-accent">{setPathModal.workspace}</span> belum punya path tersimpan. Pilih folder untuk mulai indexing.
            </p>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs text-text-secondary">Workspace Folder Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={setPathValue}
                  onChange={(e) => setSetPathValue(e.target.value)}
                  placeholder="/path/to/workspace-folder"
                  className="flex-1 rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                />
                <button
                  onClick={() => setSetPathBrowserOpen(true)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-accent px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  📁 Browse
                </button>
              </div>
              <p className="mt-1 text-[10px] text-text-muted">
                Path ini akan disimpan untuk indexing dan re-index di kemudian hari.
              </p>
            </div>

            {setPathValue && (
              <div className="mb-4 rounded-lg border border-border-input bg-bg-input p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted">Collection:</span>
                  <span className="font-medium text-emerald-400">{setPathModal.collection}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setSetPathModal(null); setSetPathValue(""); }}
                className="rounded-lg border border-border-input px-4 py-2 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
              >
                Batal
              </button>
              <button
                onClick={submitSetPath}
                disabled={!setPathValue || store.isRunning}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Simpan & Index
              </button>
            </div>
          </div>

          <FolderBrowser
            isOpen={setPathBrowserOpen}
            onClose={() => setSetPathBrowserOpen(false)}
            onSelect={(path) => setSetPathValue(path)}
            initialPath={undefined}
          />
        </div>
      )}
    </div>
  );
}
