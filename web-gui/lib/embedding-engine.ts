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

const INDEXER_VERSION = "1.0.0";

export type EmbeddingProgress = {
  percent: number;
  status: "idle" | "scanning" | "creating_collection" | "embedding" | "completed" | "stopped" | "error";
  currentFile: string;
  totalFiles: number;
  processedFiles: number;
  errors: string[];
};

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
  extensions: string[];
  includeSubfolders: boolean;
  workspace: string;
  project: string;
};

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

export function getProgress(): EmbeddingProgress {
  return { ...progress };
}

export function requestStop(): void {
  stopRequested = true;
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
async function createCollection(qdrantUrl: string, name: string, vectorSize: number): Promise<void> {
  const resp = await fetch(`${qdrantUrl}/collections/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: { size: vectorSize, distance: "Cosine" },
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
  if (!resp.ok) throw new Error(`Qdrant upsert error: ${resp.status}`);
}

// Main embedding worker
export async function startEmbedding(config: EmbeddingConfig): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  stopRequested = false;
  progress = { percent: 0, status: "idle", currentFile: "", totalFiles: 0, processedFiles: 0, errors: [] };

  try {
    // Create collection if needed
    if (config.createNew) {
      progress.status = "creating_collection";
      await createCollection(config.qdrantUrl, config.collectionName, config.vectorSize);
    }

    // Scan files
    progress.status = "scanning";
    const files = scanFiles(config.folderPath, config.extensions, config.includeSubfolders);
    progress.totalFiles = files.length;

    if (files.length === 0) {
      progress.status = "completed";
      progress.percent = 100;
      isRunning = false;
      return;
    }

    // Process files
    progress.status = "embedding";
    const batchSize = 10;
    let batch: unknown[] = [];
    const indexedAt = Math.floor(Date.now() / 1000);

    for (let i = 0; i < files.length; i++) {
      if (stopRequested) {
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

        // Derive project from first subfolder level (like iam-rag scanner)
        // e.g. relativePath = "qcash-ui/src/App.tsx" → project = "qcash-ui"
        const pathParts = relativePath.split("/");
        const projectName = pathParts.length > 1 ? pathParts[0] : config.project || basename(config.folderPath);

        const fileStat = statSync(filePath);
        const modified = fileStat.mtimeMs / 1000; // Unix timestamp (seconds)

        const chunks = chunkText(content, config.chunkSize, config.chunkOverlap);

        for (let ci = 0; ci < chunks.length; ci++) {
          if (stopRequested) {
            progress.status = "stopped";
            isRunning = false;
            return;
          }

          const chunk = chunks[ci];
          const vector = await getEmbedding(config.ollamaUrl, config.model, chunk.text);
          const chunkHash = hashChunk(chunk.text);
          const pointId = generatePointId(config.workspace, projectName, relativePath, ci);
          const symbols = extractSymbols(chunk.text, ext);

          batch.push({
            id: pointId,
            vector,
            payload: {
              source: {
                workspace: config.workspace,
                project: projectName,
                relative_path: relativePath,
                extension: ext,
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
            batch = [];
          }
        }
      } catch (err) {
        progress.errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }

      progress.processedFiles = i + 1;
      progress.percent = Math.round(((i + 1) / files.length) * 100);
    }

    // Flush remaining batch
    if (batch.length > 0) {
      await upsertPoints(config.qdrantUrl, config.collectionName, batch);
    }

    progress.status = "completed";
    progress.percent = 100;
  } catch (err) {
    progress.status = "error";
    progress.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isRunning = false;
  }
}
