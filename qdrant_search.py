#!/usr/bin/env python3
"""
Semantic search tool for Qdrant using Ollama embedding.
Reads settings from qdrant_config.json (same directory as this script).

Usage:
    python qdrant_search.py "query text here"
    python qdrant_search.py "query" --project qcash-ui
    python qdrant_search.py "query" --workspace bri
    python qdrant_search.py "query" --ext .tsx
    python qdrant_search.py "query" --limit 10
    python qdrant_search.py "query" --collection developer_ai
"""

import argparse
import json
import os
import sys
import urllib.request
from typing import List, Optional, Dict
from pathlib import Path

# ─── Config Loading ────────────────────────────────────────────────────────────

CONFIG_PATH = Path(__file__).parent / "qdrant_config.json"


def load_config() -> dict:
    """Load configuration from qdrant_config.json."""
    if not CONFIG_PATH.exists():
        # Fallback defaults if config doesn't exist
        return {
            "qdrant_url": "http://localhost:6333",
            "ollama_url": "http://localhost:11434",
            "embed_model": "nomic-embed-text:latest",
            "default_collection": "developer_ai",
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


# ─── Core Functions ────────────────────────────────────────────────────────────


def get_embedding(text: str) -> List[float]:
    """Generate embedding via Ollama."""
    payload = json.dumps({"model": MODEL, "prompt": text}).encode()
    req = urllib.request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return data["embedding"]


def search_qdrant(vector: List[float], limit: int = 5, filters: Optional[Dict] = None) -> list:
    """Query Qdrant with vector and optional filters."""
    body = {
        "query": vector,
        "limit": limit,
        "with_payload": True,
        "with_vector": False,
    }
    if filters:
        body["filter"] = filters

    payload = json.dumps(body).encode()
    url = f"{QDRANT_URL}/collections/{COLLECTION}/points/query"
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return data.get("result", {}).get("points", [])


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

    print(f"\n🔍 Ditemukan {len(points)} hasil:\n")
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


# ─── Main ──────────────────────────────────────────────────────────────────────


def main():
    global COLLECTION

    parser = argparse.ArgumentParser(description="Semantic search Qdrant via Ollama embedding")
    parser.add_argument("query", help="Search query text")
    parser.add_argument("--project", "-p", help="Filter by project name")
    parser.add_argument("--workspace", "-w", help="Filter by workspace name")
    parser.add_argument("--ext", "-e", help="Filter by file extension (e.g. .tsx)")
    parser.add_argument("--limit", "-l", type=int, default=5, help="Number of results (default: 5)")
    parser.add_argument("--collection", "-c", help=f"Qdrant collection name (default: {COLLECTION})")
    parser.add_argument("--no-content", action="store_true", help="Hide content preview")

    args = parser.parse_args()

    # Override collection if specified via flag
    if args.collection:
        COLLECTION = args.collection

    print(f"🧠 Generating embedding for: \"{args.query}\"")
    vector = get_embedding(args.query)

    filters = build_filter(project=args.project, workspace=args.workspace, ext=args.ext)
    if filters:
        print(f"🔎 Filters: {json.dumps(filters, indent=2)}")

    points = search_qdrant(vector, limit=args.limit, filters=filters)
    print_results(points, show_content=not args.no_content)


if __name__ == "__main__":
    main()
