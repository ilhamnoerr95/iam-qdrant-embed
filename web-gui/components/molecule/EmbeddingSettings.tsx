"use client";

import { useEmbedStore } from "@/store/useEmbedStore";

export default function EmbeddingSettings() {
  const { models, modelDetails, model, chunkSize, chunkOverlap, vectorSize, workspace, setModel, setChunkSize, setChunkOverlap, setWorkspace, setVectorSize } =
    useEmbedStore();

  const handleModelChange = (name: string) => {
    setModel(name);
    // Auto-update vector size based on model's embedding length
    const detail = modelDetails.find((d) => d.name === name);
    if (detail?.embeddingLength) {
      setVectorSize(detail.embeddingLength);
    }
  };

  return (
    <div className="rounded-xl border border-border-default bg-bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">🧠 Embedding Settings</div>

      {/* Workspace */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs text-text-secondary">Workspace</label>
        <input
          type="text"
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
          placeholder="e.g. ai, bri, mines"
          className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <p className="mt-1 text-[10px] text-text-muted">Project otomatis dari subfolder di folder path</p>
      </div>

      {/* Model */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs text-text-secondary">Model</label>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
        >
          {models.length === 0 ? (
            <option value="">-- Connect Ollama first --</option>
          ) : (
            <>
              {modelDetails.length > 0 ? (
                <>
                  <optgroup label="🧠 Embedding Models">
                    {modelDetails.filter((d) => d.isEmbedding).map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.embeddingLength || "?"} dim, {d.parameterSize})
                      </option>
                    ))}
                  </optgroup>
                  {modelDetails.some((d) => !d.isEmbedding) && (
                    <optgroup label="💬 Chat Models (bukan untuk embed)">
                      {modelDetails.filter((d) => !d.isEmbedding).map((d) => (
                        <option key={d.name} value={d.name} disabled>
                          {d.name} ({d.parameterSize}) — not embedding
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))
              )}
            </>
          )}
        </select>
        {model && modelDetails.length > 0 && (() => {
          const detail = modelDetails.find((d) => d.name === model);
          if (detail?.isEmbedding) {
            return <p className="mt-1 text-[10px] text-accent">✓ Embedding model — {detail.embeddingLength} dimensi</p>;
          } else if (detail) {
            return <p className="mt-1 text-[10px] text-danger">⚠️ Bukan embedding model</p>;
          }
          return null;
        })()}
      </div>

      {/* Chunk Size */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs text-text-secondary">Chunk Size (chars)</label>
        <div className="flex items-center">
          <button
            onClick={() => setChunkSize(Math.max(100, chunkSize - 50))}
            className="rounded-l-lg border border-border-input bg-bg-input px-3 py-2 text-text-primary hover:bg-border-input"
          >−</button>
          <input
            type="number"
            value={chunkSize}
            onChange={(e) => setChunkSize(Math.max(100, parseInt(e.target.value) || 100))}
            className="w-20 border-y border-border-input bg-bg-input py-2 text-center text-sm text-text-primary outline-none"
          />
          <button
            onClick={() => setChunkSize(Math.min(5000, chunkSize + 50))}
            className="rounded-r-lg border border-border-input bg-bg-input px-3 py-2 text-text-primary hover:bg-border-input"
          >+</button>
        </div>
      </div>

      {/* Chunk Overlap */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs text-text-secondary">Chunk Overlap (chars)</label>
        <div className="flex items-center">
          <button
            onClick={() => setChunkOverlap(Math.max(0, chunkOverlap - 10))}
            className="rounded-l-lg border border-border-input bg-bg-input px-3 py-2 text-text-primary hover:bg-border-input"
          >−</button>
          <input
            type="number"
            value={chunkOverlap}
            onChange={(e) => setChunkOverlap(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-20 border-y border-border-input bg-bg-input py-2 text-center text-sm text-text-primary outline-none"
          />
          <button
            onClick={() => setChunkOverlap(Math.min(500, chunkOverlap + 10))}
            className="rounded-r-lg border border-border-input bg-bg-input px-3 py-2 text-text-primary hover:bg-border-input"
          >+</button>
        </div>
      </div>

      {/* Embedding Dimension (readonly) */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs text-text-secondary">Embedding Dimension</label>
        <input
          type="number"
          value={vectorSize}
          readOnly
          className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary opacity-70 outline-none"
        />
      </div>

      <div className="rounded-md border-l-[3px] border-accent bg-bg-input p-2.5 text-[11px] text-text-secondary">
        💡 Gunakan model embedding seperti nomic-embed-text, mxbai-embed-large, all-minilm
      </div>
    </div>
  );
}
