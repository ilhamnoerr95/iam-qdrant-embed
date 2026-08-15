/**
 * Embedding engine — handles the background embedding process.
 * Payload format matches iam-rag structure:
 *   source: { workspace, project, relative_path, extension }
 *   chunk: { index, hash, modified, start_line, end_line }
 *   content: string
 *   symbols: string[]
 *   metadata: { indexed_at, indexer_version, chunk_size, embed_model }
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative, basename } from "path";
import crypto from "crypto";

const INDEXER_VERSION = "2.1.0";

export type EmbeddingProgress = {
  percent: number;
  status: "idle" | "scanning" | "creating_collection" | "embedding" | "completed" | "stopped" | "error";
  currentFile: string;
  totalFiles: number;
  processedFiles: number;
  errors: string[];
};

export type SourceType = "workspace" | "documentation";

export type EmbeddingConfig = {
  qdrantUrl: string;
  ollamaUrl: string;
  model: string;
  chunkSize: number;
  chunkOverlap: number;
  collectionName: string;
  createNew: boolean;
  vectorSize: number;
  folderPath: string;
  includeSubfolders: boolean;
  workspace: string;
  project: string;
};

// Extension classification — determines source_type per file
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".go", ".rs",
  ".java", ".kt", ".rb", ".php", ".swift", ".c", ".cpp", ".h",
  ".cs", ".scala", ".sh", ".bash", ".zsh", ".sql", ".graphql",
  ".html", ".css", ".scss", ".sass", ".less", ".vue", ".svelte",
  ".yaml", ".yml", ".toml", ".json", ".xml", ".env.example",
]);

const DOC_EXTENSIONS = new Set([
  ".md", ".mdx", ".txt", ".rst", ".adoc", ".org", ".wiki", ".tex",
]);

// All supported extensions (code + docs combined)
const ALL_EXTENSIONS = [...CODE_EXTENSIONS, ...DOC_EXTENSIONS];

export function getAllExtensions(): string[] {
  return ALL_EXTENSIONS;
}

// Determine source_type per file based on extension
function getSourceTypeForFile(ext: string): SourceType {
  if (DOC_EXTENSIONS.has(ext)) return "documentation";
  return "workspace";
}

// Derive content_type from source_type
function getContentType(sourceType: SourceType): string {
  return sourceType === "workspace" ? "code" : "documentation";
}

// Module-level state
let progress: EmbeddingProgress = {
  percent: 0,
  status: "idle",
  currentFile: "",
  totalFiles: 0,
  processedFiles: 0,
  errors: [],
};

let stopRequested = false;
let isRunning = false;

// Logging — in-memory ring buffer for real-time logs
export type LogEntry = {
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
};

const MAX_LOGS = 500;
let logs: LogEntry[] = [];
let logCursor = 0; // Increments with each log, for client polling offset

function addLog(level: LogEntry["level"], message: string): void {
  logs.push({ timestamp: Date.now(), level, message });
  logCursor++;
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }
}

export function getLogs(sinceIndex?: number): { logs: LogEntry[]; cursor: number } {
  if (sinceIndex !== undefined && sinceIndex > 0) {
    const offset = Math.max(0, logs.length - (logCursor - sinceIndex));
    return { logs: logs.slice(offset), cursor: logCursor };
  }
  return { logs: [...logs], cursor: logCursor };
}

export function clearLogs(): void {
  logs = [];
  logCursor = 0;
}

export function getProgress(): EmbeddingProgress {
  return { ...progress };
}

export function requestStop(): void {
  stopRequested = true;
  addLog("warn", "Stop requested by user");
}

export function resetState(): void {
  stopRequested = false;
  isRunning = false;
  progress = {
    percent: 0,
    status: "idle",
    currentFile: "",
    totalFiles: 0,
    processedFiles: 0,
    errors: [],
  };
  clearLogs();
}

export function getIsRunning(): boolean {
  return isRunning;
}

// File scanning
export function scanFiles(folderPath: string, extensions: string[], includeSubfolders: boolean): string[] {
  const files: string[] = [];

  function scan(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith(".") || ["node_modules", "dist", "build", "__pycache__", ".git", ".next", "target", "vendor"].includes(entry.name)) continue;
          if (includeSubfolders) scan(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  scan(folderPath);
  return files;
}

// Line-aware chunking — returns chunks with start/end line info
type ChunkInfo = {
  text: string;
  startLine: number;
  endLine: number;
};

export function chunkText(text: string, chunkSize: number, chunkOverlap: number): ChunkInfo[] {
  const chunks: ChunkInfo[] = [];
  const lines = text.split("\n");
  let currentChunk = "";
  let chunkStartLine = 1;
  let currentLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const potentialChunk = currentChunk ? currentChunk + "\n" + line : line;

    if (potentialChunk.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk,
          startLine: chunkStartLine,
          endLine: currentLine - 1,
        });
      }

      // Calculate overlap: go back some lines to create overlap
      const overlapChars = chunkOverlap;
      let overlapStart = currentChunk.length - overlapChars;
      if (overlapStart < 0) overlapStart = 0;

      // Find line boundary for overlap
      const overlapText = currentChunk.slice(overlapStart);
      const overlapLines = overlapText.split("\n").length - 1;

      chunkStartLine = Math.max(1, currentLine - overlapLines);
      currentChunk = overlapText + "\n" + line;
      currentLine = i + 1;
    } else {
      currentChunk = potentialChunk;
      currentLine = i + 1;
    }
  }

  // Last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk,
      startLine: chunkStartLine,
      endLine: lines.length,
    });
  }

  return chunks;
}

// Extract symbols (function/class/variable names) from code chunk
function extractSymbols(text: string, extension: string): string[] {
  const symbols: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Python: def, class, async def
    if ([".py"].includes(extension)) {
      const pyFunc = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
      if (pyFunc) symbols.push(pyFunc[1]);
      const pyClass = trimmed.match(/^class\s+(\w+)/);
      if (pyClass) symbols.push(pyClass[1]);
    }

    // TypeScript/JavaScript: function, class, const/let/var exports, arrow functions
    if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(extension)) {
      const jsFunc = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (jsFunc) symbols.push(jsFunc[1]);
      const jsClass = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
      if (jsClass) symbols.push(jsClass[1]);
      const jsConst = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/);
      if (jsConst) symbols.push(jsConst[1]);
      const jsType = trimmed.match(/^(?:export\s+)?(?:type|interface)\s+(\w+)/);
      if (jsType) symbols.push(jsType[1]);
    }

    // Go: func, type
    if ([".go"].includes(extension)) {
      const goFunc = trimmed.match(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/);
      if (goFunc) symbols.push(goFunc[1]);
      const goType = trimmed.match(/^type\s+(\w+)/);
      if (goType) symbols.push(goType[1]);
    }

    // Rust: fn, struct, enum, trait, impl
    if ([".rs"].includes(extension)) {
      const rsFunc = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
      if (rsFunc) symbols.push(rsFunc[1]);
      const rsStruct = trimmed.match(/^(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)/);
      if (rsStruct) symbols.push(rsStruct[1]);
    }

    // Java/Kotlin: class, interface, method patterns
    if ([".java", ".kt"].includes(extension)) {
      const javaClass = trimmed.match(/^(?:public|private|protected)?\s*(?:abstract\s+)?(?:class|interface)\s+(\w+)/);
      if (javaClass) symbols.push(javaClass[1]);
      const javaMethod = trimmed.match(/^(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/);
      if (javaMethod) symbols.push(javaMethod[1]);
    }

    // Ruby: def, class, module
    if ([".rb"].includes(extension)) {
      const rbDef = trimmed.match(/^def\s+(\w+)/);
      if (rbDef) symbols.push(rbDef[1]);
      const rbClass = trimmed.match(/^(?:class|module)\s+(\w+)/);
      if (rbClass) symbols.push(rbClass[1]);
    }

    // PHP: function, class
    if ([".php"].includes(extension)) {
      const phpFunc = trimmed.match(/^(?:public|private|protected|static|\s)*function\s+(\w+)/);
      if (phpFunc) symbols.push(phpFunc[1]);
      const phpClass = trimmed.match(/^(?:abstract\s+)?class\s+(\w+)/);
      if (phpClass) symbols.push(phpClass[1]);
    }
  }

  return [...new Set(symbols)]; // dedupe
}

// ─── BM25 Sparse Vector Generation ──────────────────────────────────────────
// Simple BM25-style tokenization: tokenize text into terms, compute term frequencies,
// and return sparse vector format {indices: number[], values: number[]}
// Uses a basic hash function to map tokens to indices (no vocabulary needed)

type SparseVector = {
  indices: number[];
  values: number[];
};

// Common stop words to filter out (minimal set for code + docs)
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "this", "that", "it",
  "its", "i", "me", "my", "we", "our", "you", "your", "he", "him",
  "his", "she", "her", "they", "them", "their", "what", "which", "who",
  "whom", "these", "those", "am", "up", "about",
]);

function tokenize(text: string): string[] {
  // Split on non-alphanumeric (handles camelCase, snake_case, etc.)
  return text
    .toLowerCase()
    // Split camelCase: "camelCase" → "camel case"
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Split on non-word chars
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && t.length < 40 && !STOP_WORDS.has(t));
}

function tokenToIndex(token: string): number {
  // Simple hash to map token → sparse index (deterministic, no collisions for practical use)
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
  }
  // Map to positive index space (0 to 2^30)
  return Math.abs(hash) % (1 << 30);
}

function generateSparseVector(text: string): SparseVector {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { indices: [], values: [] };

  // Count term frequencies
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Convert to sparse vector: index = hash(token), value = TF (Qdrant handles IDF via modifier)
  const indexValuePairs: [number, number][] = [];
  for (const [token, count] of tf) {
    const idx = tokenToIndex(token);
    // BM25-like TF saturation: tf / (tf + k1), k1=1.2
    const tfScore = count / (count + 1.2);
    indexValuePairs.push([idx, tfScore]);
  }

  // Sort by index (Qdrant requires sorted indices)
  indexValuePairs.sort((a, b) => a[0] - b[0]);

  // Deduplicate indices (in case of hash collision, sum values)
  const deduped = new Map<number, number>();
  for (const [idx, val] of indexValuePairs) {
    deduped.set(idx, (deduped.get(idx) || 0) + val);
  }

  const sorted = [...deduped.entries()].sort((a, b) => a[0] - b[0]);
  return {
    indices: sorted.map(([idx]) => idx),
    values: sorted.map(([, val]) => val),
  };
}

// ─── End BM25 ───────────────────────────────────────────────────────────────

// Generate hash for chunk content
function hashChunk(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// Generate deterministic point ID
function generatePointId(workspace: string, project: string, relativePath: string, chunkIndex: number): string {
  const seed = `${workspace}/${project}/${relativePath}::${chunkIndex}`;
  const hash = crypto.createHash("md5").update(seed).digest("hex").slice(0, 32);
  return toUUID(hash);
}

function toUUID(hash: string): string {
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Embedding via Ollama (with retry)
async function getEmbedding(ollamaUrl: string, model: string, text: string): Promise<number[]> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        lastError = new Error(`Ollama error: ${resp.status} ${errBody.slice(0, 100)}`);
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
        continue;
      }

      const data = await resp.json();

      // Check for empty embedding (Ollama returns [] for empty prompts)
      if (!data.embedding || data.embedding.length === 0) {
        throw new Error("Empty embedding returned — possibly empty or invalid content");
      }

      return data.embedding;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Embedding failed after retries");
}

// Qdrant operations

// Detect if collection uses named vectors (e.g. "dense") or unnamed
async function getVectorName(qdrantUrl: string, collection: string): Promise<string | null> {
  try {
    const resp = await fetch(`${qdrantUrl}/collections/${collection}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const vectors = data?.result?.config?.params?.vectors;
    if (!vectors) return null;
    // If vectors has "size" directly → unnamed vectors
    if (vectors.size) return null;
    // If vectors is an object with named keys (e.g. "dense") → named vectors
    const keys = Object.keys(vectors);
    if (keys.length > 0 && vectors[keys[0]]?.size) return keys[0];
    return null;
  } catch {
    return null;
  }
}

async function createCollection(qdrantUrl: string, name: string, vectorSize: number): Promise<void> {
  const resp = await fetch(`${qdrantUrl}/collections/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: {
        dense: { size: vectorSize, distance: "Cosine" },
      },
      sparse_vectors: {
        sparse: { modifier: "idf" },
      },
    }),
  });
  if (!resp.ok && resp.status !== 409) {
    throw new Error(`Failed to create collection: ${resp.status}`);
  }
}

async function upsertPoints(qdrantUrl: string, collection: string, points: unknown[]): Promise<void> {
  const resp = await fetch(`${qdrantUrl}/collections/${collection}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Qdrant upsert error: ${resp.status} — ${errBody.slice(0, 200)}`);
  }
}

// Main embedding worker
export async function startEmbedding(config: EmbeddingConfig): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  stopRequested = false;
  progress = { percent: 0, status: "idle", currentFile: "", totalFiles: 0, processedFiles: 0, errors: [] };
  clearLogs();

  addLog("info", `Starting embedding — workspace: ${config.workspace}, collection: ${config.collectionName}`);
  addLog("info", `Model: ${config.model} | Chunk size: ${config.chunkSize}`);
  addLog("info", `Folder: ${config.folderPath}`);

  try {
    // Always ensure collection exists (idempotent — 409 = already exists, that's fine)
    progress.status = "creating_collection";
    addLog("info", `Ensuring collection "${config.collectionName}" exists (${config.vectorSize} dimensions)...`);
    await createCollection(config.qdrantUrl, config.collectionName, config.vectorSize);
    addLog("success", `Collection "${config.collectionName}" ready`);

    // Detect if collection uses named vectors (for compatibility)
    const vectorName = await getVectorName(config.qdrantUrl, config.collectionName);
    if (vectorName) {
      addLog("info", `Collection uses named vectors: "${vectorName}"`);
    }

    // Scan files — all supported extensions (code + docs)
    progress.status = "scanning";
    addLog("info", "Scanning files...");
    const extensions = getAllExtensions();
    const files = scanFiles(config.folderPath, extensions, config.includeSubfolders);
    progress.totalFiles = files.length;
    addLog("info", `Found ${files.length} files to process`);

    if (files.length === 0) {
      addLog("warn", "No files found matching the source type extensions");
      progress.status = "completed";
      progress.percent = 100;
      isRunning = false;
      return;
    }

    // Process files
    progress.status = "embedding";
    addLog("info", "Starting embedding process...");
    const batchSize = 10;
    let batch: unknown[] = [];
    const indexedAt = Math.floor(Date.now() / 1000);
    let totalChunksProcessed = 0;

    for (let i = 0; i < files.length; i++) {
      if (stopRequested) {
        addLog("warn", `Stopped at file ${i + 1}/${files.length}`);
        progress.status = "stopped";
        isRunning = false;
        return;
      }

      const filePath = files[i];
      progress.currentFile = filePath;
      progress.processedFiles = i;

      try {
        const content = readFileSync(filePath, "utf-8");
        if (!content.trim()) continue;

        const ext = extname(filePath);
        const relativePath = relative(config.folderPath, filePath);

        const pathParts = relativePath.split("/");
        const projectName = pathParts.length > 1 ? pathParts[0] : config.project || basename(config.folderPath);

        const fileStat = statSync(filePath);
        const modified = fileStat.mtimeMs / 1000;

        const chunks = chunkText(content, config.chunkSize, config.chunkOverlap);
        addLog("info", `[${i + 1}/${files.length}] ${relativePath} → ${chunks.length} chunks`);

        for (let ci = 0; ci < chunks.length; ci++) {
          if (stopRequested) {
            addLog("warn", `Stopped at file ${i + 1}/${files.length}`);
            progress.status = "stopped";
            isRunning = false;
            return;
          }

          const chunk = chunks[ci];
          const vector = await getEmbedding(config.ollamaUrl, config.model, chunk.text);
          const chunkHash = hashChunk(chunk.text);
          const pointId = generatePointId(config.workspace.toLowerCase(), projectName, relativePath, ci);
          const symbols = extractSymbols(chunk.text, ext);
          const sparseVector = generateSparseVector(chunk.text);

          batch.push({
            id: pointId,
            vector: {
              dense: vector,
              sparse: sparseVector,
            },
            payload: {
              source: {
                workspace: config.workspace.toLowerCase(),
                project: projectName,
                relative_path: relativePath,
                extension: ext,
                source_type: getSourceTypeForFile(ext),
                content_type: getContentType(getSourceTypeForFile(ext)),
              },
              chunk: {
                index: ci,
                hash: chunkHash,
                modified,
                start_line: chunk.startLine,
                end_line: chunk.endLine,
              },
              content: chunk.text,
              symbols,
              metadata: {
                indexed_at: indexedAt,
                indexer_version: INDEXER_VERSION,
                chunk_size: config.chunkSize,
                embed_model: config.model,
              },
            },
          });

          if (batch.length >= batchSize) {
            await upsertPoints(config.qdrantUrl, config.collectionName, batch);
            totalChunksProcessed += batch.length;
            batch = [];
          }
        }
      } catch (err) {
        const errMsg = `${filePath}: ${err instanceof Error ? err.message : String(err)}`;
        progress.errors.push(errMsg);
        addLog("error", errMsg);
      }

      progress.processedFiles = i + 1;
      progress.percent = Math.round(((i + 1) / files.length) * 100);
    }

    // Flush remaining batch
    if (batch.length > 0) {
      await upsertPoints(config.qdrantUrl, config.collectionName, batch);
      totalChunksProcessed += batch.length;
    }

    progress.status = "completed";
    progress.percent = 100;
    addLog("success", `Embedding completed! ${files.length} files, ${totalChunksProcessed} chunks stored.`);
  } catch (err) {
    progress.status = "error";
    const errMsg = `Fatal: ${err instanceof Error ? err.message : String(err)}`;
    progress.errors.push(errMsg);
    addLog("error", errMsg);
  } finally {
    isRunning = false;
  }
}
