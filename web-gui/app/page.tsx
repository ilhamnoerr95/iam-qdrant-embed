"use client";

import { useEffect, useRef } from "react";
import { useEmbedStore } from "@/store/useEmbedStore";
import Sidebar from "@/components/organism/Sidebar";
import ConnectionCard from "@/components/molecule/ConnectionCard";
import EmbeddingSettings from "@/components/molecule/EmbeddingSettings";
import CollectionSelector from "@/components/molecule/CollectionSelector";
import FolderPicker from "@/components/molecule/FolderPicker";
import IndexedWorkspaces from "@/components/molecule/IndexedWorkspaces";
import ToastContainer from "@/components/atom/Toast";
import { showToast } from "@/components/atom/Toast";

export default function Home() {
  const store = useEmbedStore();
  const autoConnectDone = useRef(false);

  const testQdrant = async () => {
    store.setQdrantStatus("testing");
    try {
      const resp = await fetch("/api/test-qdrant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: store.qdrantUrl }),
      });
      const data = await resp.json();
      store.setQdrantStatus(data.success ? "connected" : "failed");
      if (data.success) {
        loadCollections();
      } else {
        showToast("error", "Qdrant gagal connect", data.message || store.qdrantUrl);
      }
    } catch {
      store.setQdrantStatus("failed");
      showToast("error", "Qdrant gagal connect", "Pastikan Qdrant sedang running");
    }
  };

  const testOllama = async () => {
    store.setOllamaStatus("testing");
    try {
      const resp = await fetch("/api/test-ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: store.ollamaUrl }),
      });
      const data = await resp.json();
      store.setOllamaStatus(data.success ? "connected" : "failed");
      if (data.success) {
        loadModels();
      } else {
        showToast("error", "Ollama gagal connect", data.message || store.ollamaUrl);
      }
    } catch {
      store.setOllamaStatus("failed");
      showToast("error", "Ollama gagal connect", "Pastikan Ollama sedang running");
    }
  };

  const loadModels = async () => {
    try {
      const resp = await fetch(`/api/ollama-models?url=${encodeURIComponent(store.ollamaUrl)}`);
      const data = await resp.json();
      if (data.models?.length) {
        store.setModels(data.models);
        if (data.details) {
          store.setModelDetails(data.details);
          // Auto-select first embedding model if none selected
          if (!store.model) {
            const firstEmbed = data.details.find((d: { isEmbedding: boolean }) => d.isEmbedding);
            store.setModel(firstEmbed ? firstEmbed.name : data.models[0]);
          }
          // Auto-set vector size from selected model's embedding length
          const selected = data.details.find((d: { name: string }) => d.name === store.model);
          if (selected?.embeddingLength) {
            store.setVectorSize(selected.embeddingLength);
          }
        } else {
          if (!store.model) store.setModel(data.models[0]);
        }
      }
    } catch { /* ignore */ }
  };

  const loadCollections = async () => {
    try {
      const resp = await fetch(`/api/collections?url=${encodeURIComponent(store.qdrantUrl)}`);
      const data = await resp.json();
      if (data.collections?.length) {
        store.setCollections(data.collections);
        if (!store.selectedCollection) store.setSelectedCollection(data.collections[0]);
      }
    } catch { /* ignore */ }
  };

  // Auto-connect on page load
  useEffect(() => {
    if (autoConnectDone.current) return;
    autoConnectDone.current = true;
    testQdrant();
    testOllama();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <ToastContainer />
      <main className="ml-60 flex-1 p-8">
        <h1 className="mb-1 text-2xl font-bold">Index / Embed Data</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Embed file-file ke dalam vector database untuk semantic search
        </p>

        {/* Connection Cards */}
        <div className="mb-4 flex gap-4">
          <ConnectionCard
            title="Qdrant Connection"
            icon="🔗"
            url={store.qdrantUrl}
            onUrlChange={store.setQdrantUrl}
            status={store.qdrantStatus}
            onTest={testQdrant}
          />
          <ConnectionCard
            title="Ollama Connection"
            icon="🤖"
            url={store.ollamaUrl}
            onUrlChange={store.setOllamaUrl}
            status={store.ollamaStatus}
            onTest={testOllama}
          />
        </div>

        {/* Settings Row */}
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EmbeddingSettings />
          <CollectionSelector onRefresh={loadCollections} />
        </div>

        {/* Folder & Indexing */}
        <div className="mb-4">
          <FolderPicker />
        </div>

        {/* Indexed Workspaces */}
        <IndexedWorkspaces />

        {/* Tips */}
        <div className="rounded-xl border border-border-default bg-bg-card px-5 py-3.5 text-xs text-text-secondary">
          💡 <strong>Tips:</strong> Pastikan Qdrant dan Ollama sudah running sebelum memulai. Gunakan chunk size 300-1000 untuk hasil optimal.
        </div>
      </main>
    </div>
  );
}
