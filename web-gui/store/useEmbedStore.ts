import { create } from "zustand";

export type ConnectionStatus = "idle" | "connected" | "failed" | "testing";

export type EmbeddingStatus =
  | "idle"
  | "scanning"
  | "creating_collection"
  | "embedding"
  | "completed"
  | "stopped"
  | "error";

export type ProgressState = {
  percent: number;
  status: EmbeddingStatus;
  currentFile: string;
  totalFiles: number;
  processedFiles: number;
  errors: string[];
};

type EmbedStore = {
  // Connection
  qdrantUrl: string;
  ollamaUrl: string;
  qdrantStatus: ConnectionStatus;
  ollamaStatus: ConnectionStatus;
  setQdrantUrl: (url: string) => void;
  setOllamaUrl: (url: string) => void;
  setQdrantStatus: (status: ConnectionStatus) => void;
  setOllamaStatus: (status: ConnectionStatus) => void;

  // Models & Collections
  models: string[];
  modelDetails: { name: string; isEmbedding: boolean; family: string; parameterSize: string; embeddingLength?: number }[];
  collections: string[];
  setModels: (models: string[]) => void;
  setModelDetails: (details: { name: string; isEmbedding: boolean; family: string; parameterSize: string; embeddingLength?: number }[]) => void;
  setCollections: (collections: string[]) => void;

  // Embedding settings
  model: string;
  chunkSize: number;
  chunkOverlap: number;
  vectorSize: number;
  setModel: (model: string) => void;
  setChunkSize: (size: number) => void;
  setChunkOverlap: (overlap: number) => void;
  setVectorSize: (size: number) => void;

  // Source metadata
  workspace: string;
  project: string;
  setWorkspace: (ws: string) => void;
  setProject: (proj: string) => void;

  // Collection mode
  collectionMode: "existing" | "new";
  selectedCollection: string;
  newCollectionName: string;
  setCollectionMode: (mode: "existing" | "new") => void;
  setSelectedCollection: (name: string) => void;
  setNewCollectionName: (name: string) => void;

  // Folder
  folderPath: string;
  includeSubfolders: boolean;
  setFolderPath: (path: string) => void;
  setIncludeSubfolders: (include: boolean) => void;

  // Scan stats
  totalFiles: number;
  totalSize: number;
  estimatedChunks: number;
  setScanStats: (stats: { totalFiles: number; totalSize: number; estimatedChunks: number }) => void;

  // Progress
  progress: ProgressState;
  isRunning: boolean;
  setProgress: (progress: ProgressState) => void;
  setIsRunning: (running: boolean) => void;
  resetProgress: () => void;

  // Refresh trigger — increment to force IndexedWorkspaces reload
  refreshTrigger: number;
  triggerRefresh: () => void;
};

const initialProgress: ProgressState = {
  percent: 0,
  status: "idle",
  currentFile: "",
  totalFiles: 0,
  processedFiles: 0,
  errors: [],
};

export const useEmbedStore = create<EmbedStore>((set) => ({
  // Connection
  qdrantUrl: "http://localhost:6333",
  ollamaUrl: "http://localhost:11434",
  qdrantStatus: "idle",
  ollamaStatus: "idle",
  setQdrantUrl: (url) => set({ qdrantUrl: url }),
  setOllamaUrl: (url) => set({ ollamaUrl: url }),
  setQdrantStatus: (status) => set({ qdrantStatus: status }),
  setOllamaStatus: (status) => set({ ollamaStatus: status }),

  // Models & Collections
  models: [],
  modelDetails: [],
  collections: [],
  setModels: (models) => set({ models }),
  setModelDetails: (details) => set({ modelDetails: details }),
  setCollections: (collections) => set({ collections }),

  // Embedding settings
  model: "",
  chunkSize: 500,
  chunkOverlap: 50,
  vectorSize: 768,
  setModel: (model) => set({ model }),
  setChunkSize: (size) => set({ chunkSize: size }),
  setChunkOverlap: (overlap) => set({ chunkOverlap: overlap }),
  setVectorSize: (size) => set({ vectorSize: size }),

  // Source metadata
  workspace: "",
  project: "",
  setWorkspace: (ws) => set({ workspace: ws }),
  setProject: (proj) => set({ project: proj }),

  // Collection mode
  collectionMode: "existing",
  selectedCollection: "",
  newCollectionName: "",
  setCollectionMode: (mode) => set({ collectionMode: mode }),
  setSelectedCollection: (name) => set({ selectedCollection: name }),
  setNewCollectionName: (name) => set({ newCollectionName: name }),

  // Folder
  folderPath: "",
  includeSubfolders: true,
  setFolderPath: (path) => set({ folderPath: path }),
  setIncludeSubfolders: (include) => set({ includeSubfolders: include }),

  // Scan stats
  totalFiles: 0,
  totalSize: 0,
  estimatedChunks: 0,
  setScanStats: (stats) => set(stats),

  // Progress
  progress: initialProgress,
  isRunning: false,
  setProgress: (progress) => set({ progress }),
  setIsRunning: (running) => set({ isRunning: running }),
  resetProgress: () => set({ progress: initialProgress, isRunning: false }),

  // Refresh trigger
  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
