"use client";

import { useEmbedStore } from "@/store/useEmbedStore";

type Props = {
  onRefresh: () => void;
};

export default function CollectionSelector({ onRefresh }: Props) {
  const {
    collections,
    collectionMode,
    selectedCollection,
    newCollectionName,
    vectorSize,
    setCollectionMode,
    setSelectedCollection,
    setNewCollectionName,
    setVectorSize,
  } = useEmbedStore();

  return (
    <div className="rounded-xl border border-border-default bg-bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">📦 Collection</div>

      {/* Use existing */}
      <div className="mb-3">
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="collMode"
            checked={collectionMode === "existing"}
            onChange={() => setCollectionMode("existing")}
            className="accent-accent"
          />
          Gunakan Collection yang Sudah Ada
        </label>
        {collectionMode === "existing" && (
          <div className="flex gap-2">
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="flex-1 cursor-pointer rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
            >
              {collections.length === 0 ? (
                <option value="">-- Connect Qdrant first --</option>
              ) : (
                collections.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))
              )}
            </select>
            <button
              onClick={onRefresh}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-input bg-bg-input text-text-secondary hover:border-accent hover:text-accent"
            >
              🔄
            </button>
          </div>
        )}
      </div>

      {/* Create new */}
      <div className="mb-4">
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="collMode"
            checked={collectionMode === "new"}
            onChange={() => setCollectionMode("new")}
            className="accent-accent"
          />
          Buat Collection Baru
        </label>
        {collectionMode === "new" && (
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="nama-collection-baru"
            className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
          />
        )}
      </div>

      {/* Vector Size */}
      <div>
        <label className="mb-1.5 block text-xs text-text-secondary">Vector Size</label>
        <input
          type="number"
          value={vectorSize}
          onChange={(e) => setVectorSize(parseInt(e.target.value) || 768)}
          className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
