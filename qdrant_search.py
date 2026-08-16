#!/usr/bin/env python3
"""
Hybrid search tool for Qdrant: Dense vector + Sparse BM25 + RRF fusion.
Reads settings from qdrant_config.json (same directory as this script).

Usage:
    python qdrant_search.py "query text here"
    python qdrant_search.py "query" --project qcash-ui
    python qdrant_search.py "query" --workspace bri
    python qdrant_search.py "query" --ext .tsx
    python qdrant_search.py "query" --limit 10
    python qdrant_search.py "query" --collection coba
"""

import argparse
import json
import os
import sys
import re
import hashlib
import urllib.request
from typing import List, Optional, Dict, Tuple
from pathlib import Path

# ─── Config Loading ────────────────────────────────────────────────────────────

CONFIG_PATH = Path(__file__).parent / "qdrant_config.json"


def load_config() -> dict:
    """Load configuration from qdrant_config.json."""
    if not CONFIG_PATH.exists():
        return {
            "qdrant_url": "http://localhost:6333",
            "ollama_url": "http://localhost:11434",
            "embed_model": "nomic-embed-text:latest",
            "default_collection": "coba",
            "vector_size": 768,
            "collections": [],
        }
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


config = load_config()

OLLAMA_URL = f"{config['ollama_url']}/api/embeddings"
QDRANT_URL = config["qdrant_url"]
COLLECTION = config["default_collection"]
MODEL = config["embed_model"]


# ─── BM25 Sparse Vector (same logic as embedding-engine.ts) ───────────────────

STOP_WORDS = {
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
}


def tokenize(text: str) -> List[str]:
    """Tokenize text: lowercase, split camelCase/snake_case, filter stops."""
    text = text.lower()
    # Split camelCase
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    # Split on non-word chars
    tokens = re.split(r'[^a-z0-9]+', text)
    return [t for t in tokens if len(t) > 1 and len(t) < 40 and t not in STOP_WORDS]


def token_to_index(token: str) -> int:
    """Hash token to index (same algorithm as TypeScript version)."""
    h = 0
    for ch in token:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return abs(h) % (1 << 30)


def generate_sparse_vector(text: str) -> Dict:
    """Generate BM25-style sparse vector from text."""
    tokens = tokenize(text)
    if not tokens:
        return {"indices": [], "values": []}

    # Count term frequencies
    tf = {}
    for token in tokens:
        tf[token] = tf.get(token, 0) + 1

    # Convert to sparse vector
    index_value_pairs = []
    for token, count in tf.items():
        idx = token_to_index(token)
        # BM25 TF saturation: tf / (tf + k1), k1=1.2
        tf_score = count / (count + 1.2)
        index_value_pairs.append((idx, tf_score))

    # Deduplicate and sort by index
    deduped = {}
    for idx, val in index_value_pairs:
        deduped[idx] = deduped.get(idx, 0) + val

    sorted_pairs = sorted(deduped.items())
    return {
        "indices": [idx for idx, _ in sorted_pairs],
        "values": [val for _, val in sorted_pairs],
    }


# ─── Core Functions ────────────────────────────────────────────────────────────


def get_embedding(text: str) -> List[float]:
    """Generate dense embedding via Ollama."""
    payload = json.dumps({"model": MODEL, "prompt": text}).encode()
    req = urllib.request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return data["embedding"]


def hybrid_search(query: str, limit: int = 5, filters: Optional[Dict] = None) -> list:
    """
    Hybrid search using Qdrant's prefetch + RRF fusion.
    
    Strategy:
    1. Prefetch top candidates from dense vector (semantic similarity)
    2. Prefetch top candidates from sparse vector (keyword/BM25 matching)
    3. Fuse results using Reciprocal Rank Fusion (RRF)
    """
    # Generate both vectors for the query
    dense_vector = get_embedding(query)
    sparse_vector = generate_sparse_vector(query)

    # Qdrant Query API with prefetch + RRF fusion
    # Each prefetch retrieves candidates, then fusion combines them
    prefetch_limit = limit * 5  # Get more candidates for better fusion

    body = {
        "prefetch": [
            {
                "query": dense_vector,
                "using": "dense",
                "limit": prefetch_limit,
            },
            {
                "query": sparse_vector,
                "using": "sparse",
                "limit": prefetch_limit,
            },
        ],
        "query": {"fusion": "rrf"},
        "limit": limit,
        "with_payload": True,
        "with_vector": False,
    }

    if filters:
        body["filter"] = filters

    payload = json.dumps(body).encode()
    url = f"{QDRANT_URL}/collections/{COLLECTION}/points/query"
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        return data.get("result", {}).get("points", [])
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ""
        print(f"⚠️  Hybrid search failed ({e.code}): {error_body[:200]}", file=sys.stderr)
        # Fallback to dense-only search
        print("   Falling back to dense-only search...", file=sys.stderr)
        return dense_only_search(dense_vector, limit, filters)


def dense_only_search(vector: List[float], limit: int = 5, filters: Optional[Dict] = None) -> list:
    """Fallback: dense vector only search (handles both named and unnamed vector collections)."""
    # Try named vector first ("dense"), fallback to unnamed
    for using in ["dense", None]:
        body = {
            "query": vector,
            "limit": limit,
            "with_payload": True,
            "with_vector": False,
        }
        if using:
            body["using"] = using
        if filters:
            body["filter"] = filters

        payload = json.dumps(body).encode()
        url = f"{QDRANT_URL}/collections/{COLLECTION}/points/query"
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
            return data.get("result", {}).get("points", [])
        except urllib.error.HTTPError:
            continue  # Try next format

    return []


def build_filter(project: str = None, workspace: str = None, ext: str = None) -> Optional[Dict]:
    """Build Qdrant filter from arguments."""
    conditions = []
    if project:
        conditions.append({"key": "source.project", "match": {"value": project}})
    if workspace:
        conditions.append({"key": "source.workspace", "match": {"value": workspace}})
    if ext:
        conditions.append({"key": "source.extension", "match": {"value": ext}})
    if conditions:
        return {"must": conditions}
    return None


def print_results(points: list, show_content: bool = True):
    """Pretty print search results."""
    if not points:
        print("❌ Tidak ada hasil ditemukan.")
        return

    print(f"\n🔍 Ditemukan {len(points)} hasil (hybrid: dense + sparse BM25 → RRF):\n")
    print("=" * 80)

    for i, point in enumerate(points, 1):
        payload = point.get("payload", {})
        source = payload.get("source", {})
        score = point.get("score", 0)
        content = payload.get("content", "")

        print(f"\n#{i} [score: {score:.4f}]")
        print(f"   📂 {source.get('workspace', '?')}/{source.get('project', '?')}")
        print(f"   📄 {source.get('relative_path', source.get('file_path', '?'))}")

        if show_content:
            preview = content[:500] + "..." if len(content) > 500 else content
            print(f"   ─────────────────────────────────────────")
            for line in preview.split("\n"):
                print(f"   {line}")

        print("=" * 80)


def get_all_collections() -> List[str]:
    """Get all collection names from config (excluding web-scrape types)."""
    HIDDEN = {"web"}
    collections = config.get("collections", [])
    return [c["name"] for c in collections if c["name"] not in HIDDEN]


def multi_collection_search(query: str, limit: int = 5, filters: Optional[Dict] = None, dense_only: bool = False) -> list:
    """Search across ALL collections and merge results by score."""
    global COLLECTION
    collections = get_all_collections()
    if not collections:
        collections = [COLLECTION]

    all_points = []
    original_coll = COLLECTION

    for coll in collections:
        COLLECTION = coll
        try:
            if dense_only:
                vector = get_embedding(query)
                points = dense_only_search(vector, limit=limit, filters=filters)
            else:
                points = hybrid_search(query, limit=limit, filters=filters)
            # Tag each point with its collection
            for p in points:
                p["_collection"] = coll
            all_points.extend(points)
        except Exception:
            pass  # Skip collections that error

    COLLECTION = original_coll

    # Sort by score descending, take top N
    all_points.sort(key=lambda p: p.get("score", 0), reverse=True)
    return all_points[:limit]


# ─── Token Estimation ─────────────────────────────────────────────────────────

def estimate_tokens(text: str) -> int:
    """Estimate token count (rough: ~4 chars per token for code, ~3.5 for English)."""
    # Claude tokenizer averages ~3.5-4 chars per token
    return max(1, len(text) // 4)


def get_file_sizes_for_results(points: list) -> Dict[str, int]:
    """Get estimated full file token counts from search results."""
    file_tokens = {}
    for point in points:
        payload = point.get("payload", {})
        source = payload.get("source", {})
        chunk_meta = payload.get("chunk", {})
        relative_path = source.get("relative_path", "unknown")

        # Estimate full file size from chunk info
        # If a file has N chunks of ~500 chars each, full file ≈ N * 500
        chunk_size = payload.get("metadata", {}).get("chunk_size", 500)
        # We only see some chunks, so estimate conservatively
        content = payload.get("content", "")
        end_line = chunk_meta.get("end_line", 50)

        if relative_path not in file_tokens:
            # Estimate: average file is ~200 lines × 40 chars = 8000 chars = ~2000 tokens
            # Or use end_line as indicator of file size
            estimated_file_chars = max(end_line * 40, len(content) * 3)
            file_tokens[relative_path] = estimate_tokens("x" * estimated_file_chars)

    return file_tokens


def print_stats(points: list, search_latency: float, embedding_latency: float):
    """Print RAG performance stats and comparison."""
    if not points:
        return

    # RAG context: actual chunks returned
    total_rag_chars = 0
    total_rag_tokens = 0
    chunk_details = []

    for point in points:
        content = point.get("payload", {}).get("content", "")
        tokens = estimate_tokens(content)
        total_rag_chars += len(content)
        total_rag_tokens += tokens
        chunk_details.append(tokens)

    # Non-RAG estimate: if user manually reads full files
    file_tokens = get_file_sizes_for_results(points)
    total_file_tokens = sum(file_tokens.values())
    unique_files = len(file_tokens)

    # Print comparison
    print(f"\n{'─' * 60}")
    print(f"📊 RAG Performance Stats")
    print(f"{'─' * 60}")
    print(f"")
    print(f"  ⏱️  Latency")
    print(f"      Embedding generation: {embedding_latency:.2f}s")
    print(f"      Vector search + RRF:  {search_latency:.2f}s")
    print(f"      Total:                {embedding_latency + search_latency:.2f}s")
    print(f"")
    print(f"  📦 Token Usage (estimated)")
    print(f"  ┌─────────────────────────────────────────────────────┐")
    print(f"  │  Metode              │ Tokens      │ Files          │")
    print(f"  ├─────────────────────────────────────────────────────┤")
    print(f"  │  🔴 Tanpa RAG        │ ~{total_file_tokens:<10,} │ {unique_files} full files    │")
    print(f"  │  🟢 Dengan RAG       │ ~{total_rag_tokens:<10,} │ {len(points)} chunks        │")
    print(f"  └─────────────────────────────────────────────────────┘")

    if total_file_tokens > 0:
        savings_pct = ((total_file_tokens - total_rag_tokens) / total_file_tokens) * 100
        savings_tokens = total_file_tokens - total_rag_tokens
        print(f"")
        print(f"  💰 Token Savings: ~{savings_tokens:,} tokens ({savings_pct:.0f}% lebih hemat)")
        print(f"")
        print(f"  📝 Detail per chunk: {chunk_details}")
        print(f"     Total RAG chars: {total_rag_chars:,} | tokens: ~{total_rag_tokens:,}")
        print(f"     Tanpa RAG (baca {unique_files} file penuh): ~{total_file_tokens:,} tokens")
    print(f"{'─' * 60}")


# ─── Main ──────────────────────────────────────────────────────────────────────


def main():
    global COLLECTION

    parser = argparse.ArgumentParser(description="Hybrid search Qdrant (Dense + Sparse BM25 + RRF fusion)")
    parser.add_argument("query", help="Search query text")
    parser.add_argument("--project", "-p", help="Filter by project name")
    parser.add_argument("--workspace", "-w", help="Filter by workspace name")
    parser.add_argument("--ext", "-e", help="Filter by file extension (e.g. .tsx)")
    parser.add_argument("--limit", "-l", type=int, default=5, help="Number of results (default: 5)")
    parser.add_argument("--collection", "-c", help=f"Specific collection (default: search ALL collections)")
    parser.add_argument("--no-content", action="store_true", help="Hide content preview")
    parser.add_argument("--dense-only", action="store_true", help="Use dense vector only (no hybrid)")
    parser.add_argument("--stats", action="store_true", help="Show performance stats (latency + token comparison)")

    args = parser.parse_args()

    import time

    print(f"🧠 Generating embeddings for: \"{args.query}\"")

    filters = build_filter(project=args.project, workspace=args.workspace, ext=args.ext)
    if filters:
        print(f"🔎 Filters: {json.dumps(filters, indent=2)}")

    t_start = time.time()

    if args.collection:
        # Single collection mode
        COLLECTION = args.collection
        print(f"📡 Collection: {COLLECTION}")
        if args.dense_only:
            print("📡 Mode: Dense only (semantic)")
            t_embed = time.time()
            vector = get_embedding(args.query)
            embedding_latency = time.time() - t_embed
            t_search = time.time()
            points = dense_only_search(vector, limit=args.limit, filters=filters)
            search_latency = time.time() - t_search
        else:
            print("📡 Mode: Hybrid (dense + sparse BM25 → RRF fusion)")
            t_embed = time.time()
            # Embedding happens inside hybrid_search, measure total
            embedding_latency = 0
            t_search = time.time()
            points = hybrid_search(args.query, limit=args.limit, filters=filters)
            search_latency = time.time() - t_search
            embedding_latency = search_latency * 0.7  # rough: 70% is embedding
            search_latency = search_latency * 0.3
    else:
        # Multi-collection mode (search ALL)
        all_colls = get_all_collections()
        print(f"📡 Mode: Multi-collection search ({', '.join(all_colls)})")
        if args.dense_only:
            print("   Strategy: Dense only (semantic)")
        else:
            print("   Strategy: Hybrid (dense + sparse BM25 → RRF fusion)")

        t_search = time.time()
        points = multi_collection_search(args.query, limit=args.limit, filters=filters, dense_only=args.dense_only)
        total_time = time.time() - t_search
        embedding_latency = total_time * 0.7
        search_latency = total_time * 0.3

    print_results(points, show_content=not args.no_content)

    # Show stats if requested
    if args.stats:
        print_stats(points, search_latency, embedding_latency)


if __name__ == "__main__":
    main()
