# Qdrant Embed — Local RAG untuk Developer Knowledge Base

Toolset lengkap untuk mengindex seluruh codebase ke vector database (Qdrant) dan melakukan semantic search — agar AI assistant (Kiro CLI / Claude) bisa "mengingat" semua kode yang pernah ditulis.

---

## 🎯 Apa Ini?

Sistem ini terdiri dari 3 komponen:

| Komponen | Deskripsi |
|----------|-----------|
| **Web GUI** | Next.js app untuk index/embed file ke Qdrant secara visual |
| **qdrant_search.py** | CLI script untuk semantic search dari terminal |
| **Kiro Steering File** | Auto-instruksi agar Kiro CLI bisa query Qdrant setiap sesi |

### Konsep RAG

AI model (Claude) **tidak di-fine-tune** dan **tidak menyimpan memori antar sesi**. Qdrant berfungsi sebagai **RAG (Retrieval Augmented Generation)** — memberikan potongan kode yang relevan ke model on-the-fly.

```
User: "gimana cara kerja wizard form di project giro?"
 │
 ▼
[Kiro CLI] → python3 qdrant_search.py "wizard form giro"
 │
 ▼
[Ollama] nomic-embed-text → generate embedding vector
 │
 ▼
[Qdrant] semantic search → return 5-10 chunk paling relevan
 │
 ▼
[Claude] → jawab lengkap berdasarkan konteks kode
```

---

## 📁 Struktur Project

```
~/Documents/qdrant/
├── README.md                    # Dokumentasi ini
├── qdrant_config.json           # Config utama (URL, collection, workspace paths)
├── qdrant_search.py             # CLI semantic search
├── rag.png                      # UI reference design
│
└── web-gui/                     # Next.js 16 Web GUI
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx             # Main page
    │   ├── globals.css
    │   └── api/
    │       ├── test-qdrant/     # Test koneksi Qdrant
    │       ├── test-ollama/     # Test koneksi Ollama
    │       ├── ollama-models/   # List models + detect embedding models
    │       ├── collections/     # CRUD collections (auto-sync ke config)
    │       ├── browse-folder/   # Browse server filesystem
    │       ├── scan-folder/     # Scan folder stats
    │       ├── start-embedding/ # Mulai proses embedding
    │       ├── stop-embedding/  # Stop embedding
    │       ├── progress/        # Polling progress
    │       ├── reset/           # Reset state
    │       ├── config/          # Read/write qdrant_config.json
    │       └── indexed-workspaces/ # List workspace yang sudah di-index
    ├── components/
    │   ├── atom/
    │   │   └── Toast.tsx        # Toast notification
    │   ├── molecule/
    │   │   ├── ConnectionCard.tsx
    │   │   ├── EmbeddingSettings.tsx
    │   │   ├── CollectionSelector.tsx
    │   │   ├── FolderPicker.tsx
    │   │   ├── FolderBrowser.tsx    # Modal file explorer
    │   │   ├── IndexedWorkspaces.tsx # Workspace cards + re-index
    │   │   └── ProgressSection.tsx
    │   └── organism/
    │       └── Sidebar.tsx
    ├── lib/
    │   ├── embedding-engine.ts  # Core: scan → chunk → embed → store
    │   └── config-helper.ts     # Read/write qdrant_config.json
    ├── store/
    │   └── useEmbedStore.ts     # Zustand state management
    └── utils/
        └── cn.ts                # clsx + tailwind-merge

~/.kiro/steering/
└── qdrant-knowledge-base.md     # Kiro auto-loads setiap sesi
```

---

## 🚀 Quick Start

### Prasyarat

1. **Qdrant** running di localhost:6333
   ```bash
   # Via Docker
   docker run -p 6333:6333 qdrant/qdrant

   # Atau via binary
   ./qdrant
   ```

2. **Ollama** running dengan embedding model
   ```bash
   ollama pull nomic-embed-text
   ollama serve  # biasanya sudah running
   ```

3. **Node.js** 18+ dan **Python** 3.9+

### Install & Jalankan Web GUI

```bash
cd ~/Documents/qdrant/web-gui
npm install
npm run dev
# Buka http://localhost:5001
```

Atau production mode:
```bash
npm run build
npm start
# Buka http://localhost:5001
```

---

## 🖥️ Web GUI — Cara Pakai

### 1. Buka Web GUI

Buka `http://localhost:5001`. Qdrant dan Ollama akan **auto-connect** saat halaman load.

### 2. Pilih Embedding Model

Di card **Embedding Settings**:
- Model otomatis dikelompokkan: **🧠 Embedding Models** vs **💬 Chat Models**
- Model chat di-disable (tidak bisa dipilih untuk embed)
- Pilih `nomic-embed-text:latest` (768 dimensi, 137M params)
- **Vector Size otomatis terisi** dari model yang dipilih

### 3. Set Workspace & Folder

- **Workspace**: nama grup project (contoh: `bri`, `ai`, `mines`)
- **Folder Path**: klik **Browse** untuk pilih folder via file explorer, atau ketik manual
- **Project**: otomatis terdeteksi dari subfolder level 1

Dua mode folder:

| Mode | Contoh Path | Behavior |
|------|-------------|----------|
| **Workspace** (multi-project) | `/Documents/bri/codes` | Semua subfolder = project berbeda |
| **Spesifik** (1 project) | `/Documents/bri/codes/qcash-ui` | Folder itu sendiri = 1 project |

### 4. Pilih/Buat Collection

- **Gunakan existing**: pilih dari dropdown (misal `developer_ai`)
- **Buat baru**: masukkan nama → otomatis tersimpan di config

### 5. Start Embedding

Klik **▶ Start Embedding**:
- Progress bar real-time
- Status: scanning → embedding → completed
- Toast notification muncul saat selesai/error
- Bisa **Stop** kapan saja

### 6. Re-index Workspace

Di section **📚 Indexed Workspaces**:
- Tampil semua workspace yang sudah pernah di-index
- Klik **🔄 Re-index** → langsung jalan tanpa isi ulang (path tersimpan di config)
- Tampil: jumlah chunks, daftar project, last indexed time

---

## 🔍 CLI Search — Cara Pakai

### Basic

```bash
python3 ~/Documents/qdrant/qdrant_search.py "query"
```

### Options

| Flag | Contoh | Fungsi |
|------|--------|--------|
| `--project, -p` | `--project qcash-ui` | Filter by project |
| `--workspace, -w` | `--workspace bri` | Filter by workspace |
| `--ext, -e` | `--ext .tsx` | Filter by extension |
| `--limit, -l` | `--limit 10` | Jumlah hasil (default: 5) |
| `--collection, -c` | `--collection nextjs_docs` | Override collection |
| `--no-content` | | Sembunyikan preview |

### Contoh

```bash
# Search umum
python3 ~/Documents/qdrant/qdrant_search.py "react hook form validation"

# Filter workspace + extension
python3 ~/Documents/qdrant/qdrant_search.py "authentication middleware" --workspace ai --ext .py

# Filter project spesifik
python3 ~/Documents/qdrant/qdrant_search.py "wizard step form" --project qcash-ui-registration-giro

# Search di collection lain
python3 ~/Documents/qdrant/qdrant_search.py "app router middleware" --collection nextjs_docs

# Banyak hasil tanpa preview
python3 ~/Documents/qdrant/qdrant_search.py "unit test" --limit 15 --no-content
```

### Dari Kiro CLI

Cukup bilang secara natural:
- "cari di qdrant: react form wizard"
- "search qdrant referensi authentication"
- "cek vector db, contoh unit test vitest"

Kiro otomatis menjalankan script dan menggunakan hasilnya sebagai konteks.

---

## ⚙️ Konfigurasi

Semua config di satu file: `~/Documents/qdrant/qdrant_config.json`

```json
{
  "qdrant_url": "http://localhost:6333",
  "ollama_url": "http://localhost:11434",
  "embed_model": "nomic-embed-text:latest",
  "default_collection": "developer_ai",
  "vector_size": 768,
  "collections": [...],
  "workspace_paths": {
    "bri": {
      "path": "/Users/user/Documents/bri/codes",
      "collection": "developer_ai",
      "last_indexed": "2026-08-10T..."
    }
  }
}
```

| Field | Fungsi |
|-------|--------|
| `qdrant_url` | URL Qdrant server |
| `ollama_url` | URL Ollama server |
| `embed_model` | Default embedding model |
| `default_collection` | Collection untuk CLI search |
| `collections` | Daftar collection (auto-sync dari Qdrant) |
| `workspace_paths` | Mapping workspace → folder path (auto-save saat embedding) |

Config **otomatis update** saat:
- List collections (GET) → sync jumlah vectors
- Buat collection baru → auto-add
- Hapus collection → auto-remove
- Start embedding → save workspace path + timestamp

---

## 📦 Payload Structure

Setiap chunk yang disimpan di Qdrant:

```json
{
  "source": {
    "workspace": "bri",
    "project": "qcash-ui",
    "relative_path": "qcash-ui/src/hooks/useWizard.ts",
    "extension": ".ts"
  },
  "chunk": {
    "index": 0,
    "hash": "a1b2c3d4e5f6...",
    "modified": 1723456789.0,
    "start_line": 1,
    "end_line": 50
  },
  "content": "import { useState } from 'react';\n\nexport function useWizard...",
  "symbols": ["useWizard", "WizardStep", "nextStep"],
  "metadata": {
    "indexed_at": 1723456789,
    "indexer_version": "1.0.0",
    "chunk_size": 500,
    "embed_model": "nomic-embed-text:latest"
  }
}
```

### Symbol Extraction

Otomatis extract nama function/class dari:
- **Python**: `def`, `class`, `async def`
- **TypeScript/JavaScript**: `function`, `class`, `const`, `type`, `interface`
- **Go**: `func`, `type`
- **Rust**: `fn`, `struct`, `enum`, `trait`
- **Java/Kotlin**: `class`, `interface`, methods
- **Ruby**: `def`, `class`, `module`
- **PHP**: `function`, `class`

---

## 🏗️ Tech Stack

### Web GUI

| Tech | Fungsi |
|------|--------|
| Next.js 16 | App Router + API routes |
| React 19 | UI components |
| Tailwind CSS v4 | Dark theme styling |
| Zustand | Global state management |
| clsx + tailwind-merge | Class utility |
| TypeScript | Type safety |

### Backend

| Tech | Fungsi |
|------|--------|
| Qdrant | Vector database (localhost:6333) |
| Ollama | Embedding model runtime (localhost:11434) |
| nomic-embed-text | Embedding model (768 dim, 137M params) |

### Fitur Web GUI

- ✅ Auto-connect Qdrant & Ollama on load
- ✅ Auto-detect embedding vs chat models
- ✅ Auto-set vector dimension dari model
- ✅ Browse folder via file explorer modal
- ✅ Extension filter (tag-based)
- ✅ File stats (total files, size, estimated chunks)
- ✅ Background embedding dengan progress real-time
- ✅ Re-index workspace 1-click (path tersimpan)
- ✅ Collection CRUD (auto-sync ke config)
- ✅ Toast notification (success/error/warning)
- ✅ Retry logic embedding (3x exponential backoff)
- ✅ Line-aware chunking + symbol extraction

---

## 🤖 Kiro Steering File

Agar Kiro CLI otomatis bisa query Qdrant setiap sesi, buat file steering di `~/.kiro/steering/qdrant-knowledge-base.md`:

```markdown
# Qdrant Local Vector DB - Developer Knowledge Base

## Kapan Menggunakan

Ketika user meminta:
- Referensi kode dari project sebelumnya
- Contoh implementasi yang pernah dibuat
- Pattern atau best practice dari codebase yang sudah ada
- "cari di qdrant", "search qdrant", "cek vector db"

## Info Koneksi

Semua konfigurasi dibaca dari file: `~/Documents/qdrant/qdrant_config.json`

Isi config saat ini:
- **Qdrant URL**: http://localhost:6333
- **Ollama URL**: http://localhost:11434
- **Embedding model**: nomic-embed-text:latest (768 dimensi, Cosine distance)
- **Default collection**: `developer_ai`

### Collections yang Tersedia

| Collection | Isi | Vectors |
|-----------|-----|---------|
| `developer_ai` | Main codebase — semua project & workspace | ~103,000+ |
| `nextjs_docs` | Next.js documentation | ~200 |

## Cara Akses

\```bash
python3 ~/Documents/qdrant/qdrant_search.py "query" [options]
\```

### Options
- `--project, -p` — Filter by project name
- `--workspace, -w` — Filter by workspace name
- `--ext, -e` — Filter by file extension (contoh: .tsx, .ts, .py)
- `--limit, -l` — Jumlah hasil (default: 5)
- `--collection, -c` — Override collection (default: dari config)
- `--no-content` — Sembunyikan preview content

### Contoh Penggunaan

\```bash
python3 ~/Documents/qdrant/qdrant_search.py "cloudflare email routing" --limit 5
python3 ~/Documents/qdrant/qdrant_search.py "react hook form" --workspace bri --ext .tsx
python3 ~/Documents/qdrant/qdrant_search.py "api authentication" --project qcash-ui
python3 ~/Documents/qdrant/qdrant_search.py "app router" --collection nextjs_docs
\```

## Payload Structure

Setiap point menyimpan:
- `source.workspace` — nama workspace
- `source.project` — nama project
- `source.relative_path` — path file relatif
- `source.extension` — ekstensi file
- `chunk.index` — chunk ke-berapa dari file
- `chunk.start_line` / `chunk.end_line` — baris awal/akhir
- `content` — isi kode/teks
- `symbols` — nama function/class yang terdeteksi di chunk

## Instruksi

1. Jalankan script dengan query yang relevan menggunakan tool `shell`
2. Gunakan hasil sebagai referensi untuk menjawab atau mengimplementasi
3. Jika hasil kurang relevan (score < 0.6), coba rephrase query atau tambah filter
4. Pastikan Ollama dan Qdrant sedang running sebelum query
5. Untuk search di collection tertentu, gunakan `--collection nama_collection`

## Konfigurasi

Jika perlu mengubah default collection atau URL, edit file:
\```
~/Documents/qdrant/qdrant_config.json
\```

Atau gunakan Web GUI di: `http://localhost:5001`
```

> **Note**: Ganti path `~/Documents/qdrant/` sesuai lokasi install di mesin kamu.

---

## 🔧 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Ollama error 500 | Model belum loaded. Run `ollama run nomic-embed-text` dulu, atau tunggu retry |
| Qdrant error 404 | Collection tidak ada. Buat baru atau pilih yang existing |
| Search tidak ketemu | Cek collection (default: `developer_ai`). Pakai `--collection` flag |
| Re-index gagal | Pastikan path masih valid. Cek di config `workspace_paths` |
| Empty embedding | File mungkin empty/whitespace-only. Sudah di-handle dengan skip |

---

## 📊 Perbandingan: Dengan vs Tanpa RAG

| Aspek | Tanpa RAG | Dengan RAG (Qdrant) |
|-------|-----------|---------------------|
| Cari referensi kode | Manual kasih path satu-satu | 1 query, langsung dapat |
| Cross-project | Bolak-balik 5-10x | Instan, semua sekaligus |
| Ribuan file | Tidak praktis | < 1 detik |
| Context window | Besar (baca seluruh file) | Kecil (hanya chunk relevan) |
| Perlu hafal struktur | Ya | Tidak |
| Setup awal | Tidak ada | Index sekali via Web GUI |

---

Created by **ilhamnrachman** | MIT License

*Last updated: 11 Agustus 2026*
