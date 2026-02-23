# DataVault

A unified data management platform that combines both project prompts a **hosted file system** (upload, organize, preview, search, and drag-and-drop files and folders) with a **database schema explorer** (connect to external PostgreSQL databases, extract and browse schemas, and run natural-language-to-SQL queries).

The unifying concept: database connections are first-class items inside the file system. A DB connection lives in a folder alongside files, so the two capabilities feel like one product rather than two separate tools.

Demo pt1: https://www.loom.com/share/fcd766d7a6d949788f394614dca6aff9
Demo pt2: https://www.loom.com/share/7a96fd42024c4eb287b32166516eec77

---

## Table of Contents

- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Features](#features)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Design Decisions and Tradeoffs](#design-decisions-and-tradeoffs)
- [Performance Optimizations](#performance-optimizations)
- [Security](#security)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Project Structure](#project-structure)
- [AI Usage](#ai-usage)

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Docker** (for the PostgreSQL database)
- **npm** (comes with Node.js)

### Setup (from a fresh clone)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env if needed (defaults work out of the box for local dev)

# 3. Start PostgreSQL via Docker
docker compose up -d

# 4. Run database migrations (creates tables)
npx prisma migrate dev

# 5. Generate the Prisma client
npx prisma generate

# 6. Seed the database with sample data
npm run db:seed

# 7. Start the development server
npm run dev
```

The app is now running at **http://localhost:3000**.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Next.js dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Start production server (run `build` first) |
| `npm test` | Run all 57 Jest tests (no DB required — tests use mocks) |
| `npm run lint` | Run ESLint across the codebase |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database with default user and sample folders |
| `npm run db:reset` | Reset database (drop all data, re-run migrations) |

### Resetting Everything

```bash
docker compose down -v     # Remove DB container and volume
docker compose up -d       # Fresh PostgreSQL
npx prisma migrate dev     # Re-create tables
npm run db:seed            # Re-seed sample data
```

---

## Environment Variables

Create a `.env` file from `.env.example`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://datavault:datavault@localhost:5433/datavault` | PostgreSQL connection string for the app database |
| `ENCRYPTION_KEY` | Yes | (example key in `.env.example`) | 64-character hex string (32 bytes) for AES-256-GCM encryption of stored DB passwords |
| `UPLOAD_DIR` | No | `./uploads` | Directory where uploaded files are stored on disk |
| `MAX_FILE_SIZE_MB` | No | `100` | Maximum file upload size in megabytes |
| `OPENAI_API_KEY` | No | (empty) | OpenAI API key. Enables AI features (text-to-SQL, suggested queries). Omit to use the pattern-matching fallback. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model to use for AI features |

---

## Features

### File System

- **File Upload** — Drag files from your OS onto the browser, or use the upload dialog. Files stream directly to disk via `busboy` without buffering the entire file in server memory, supporting uploads up to the configured max size (default 100 MB).
- **Folder Management** — Create, rename, delete folders. Nested folders to arbitrary depth with breadcrumb navigation and a back button for quick parent navigation.
- **Drag-and-Drop Organization** — Move files and folders between directories by dragging. Drop files onto folders in the grid view, list view, or sidebar tree. Circular reference prevention on folder moves.
- **File Preview** — Click any file to preview it inline. Images, PDFs, text, video, and audio are rendered natively in the browser.
- **Grid Thumbnails** — Image files show actual thumbnails (server-side resized to 400x400 JPEG via `sharp`). PDFs, videos, audio, code, and archives show type-specific colored icons. Google Drive-style card layout.
- **Dual View Modes** — Toggle between grid (card) and list (table) views.
- **Sorting** — Sort by name (A-Z, Z-A) or date (newest, oldest). Sorting is handled server-side.
- **Server-Side Pagination** — API endpoints return paginated results with `limit`/`offset`/`total`. The client fetches only the current page, not all records.
- **Folder Download** — Download an entire folder (with all subfolders and files) as a ZIP. The ZIP streams directly to the client without being buffered in server memory.
- **Search** — Global search across files, folders, and database connection schemas. Case-insensitive name matching with configurable limits.
- **Context Menus** — Right-click any item for quick actions (Open, Download, Rename, Delete, Preview).

### Database Schema Explorer

- **Connect to External Databases** — Provide PostgreSQL credentials; the app tests the connection before saving. Passwords are encrypted at rest with AES-256-GCM.
- **Schema Extraction** — Extracts the full schema in parallel: tables with column details, foreign key relationships, PostgreSQL enums, indexes, and inferred TypeScript interfaces. Extraction results are cached as JSONB and refreshed on demand.
- **Tabbed Schema Browser** — Browse tables, relationships, enums, indexes, and interfaces in paginated, searchable tabs with a filter bar.
- **TypeScript Interface Inference** — Automatically generates TypeScript interfaces from table schemas. Maps PostgreSQL types to TypeScript types, resolves FK relationships to interface references (`User`, `Order[]`), and handles enums as union literal types.
- **Interactive Schema Diagram** — Visual entity-relationship diagram built with ReactFlow. Shows tables as nodes and foreign keys as edges.
- **Schema Export** — Download the entire extracted schema as a JSON file.
- **Natural Language Queries (AI)** — Ask questions in plain English ("Show users who placed more than 5 orders") and the app generates SQL, validates it for safety, executes it in a read-only transaction on the external database, and displays the results in a table. Powered by GPT-4o-mini when an OpenAI key is configured, with a pattern-matching fallback otherwise.
- **AI Status Detection** — The frontend detects whether the OpenAI key is configured and adjusts the UI accordingly (shows AI badge when enabled, simpler interface when not).

### Sidebar

- **Folder Tree** — Full recursive folder tree loaded via a PostgreSQL recursive CTE. Expandable/collapsible nodes. Clicking a folder navigates to it.
- **DB Connection List** — All database connections listed with refresh and delete actions.
- **Global Search** — Debounced search bar (300 ms) that searches across files, folders, and DB schemas. Results appear in a dropdown.
- **Drag-and-Drop Targets** — Sidebar folders accept drag-and-drop for moving items. Auto-expand behavior on hover (800 ms delay).
---

## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ File Explorer │  │ Schema Viewer│  │ Search / Query Runner  │ │
│  │  (drag/drop,  │  │  (tables,    │  │  (full-text search,    │ │
│  │   upload,     │  │   diagram,   │  │   text-to-SQL)         │ │
│  │   preview)    │  │   export)    │  │                        │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
│         │                 │                       │              │
└─────────┼─────────────────┼───────────────────────┼──────────────┘
          │ fetch            │ fetch                  │ fetch
          ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Server (API Routes)                  │
│                                                                 │
│  ┌────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ /api/files  │ │/api/folders   │ │/api/search│ │/api/db-conn  │ │
│  │  [id]/prev  │ │  [id]/download│ │          │ │  [id]/extract│ │
│  │  [id]/thumb │ │  /tree       │ │          │ │  [id]/query  │ │
│  └──────┬──────┘ └──────┬───────┘ └────┬─────┘ └──────┬───────┘ │
│         │               │              │               │         │
│         ▼               ▼              ▼               │         │
│  ┌─────────────────────────────────────────────┐       │         │
│  │           Prisma ORM (App Database)          │       │         │
│  │  PostgreSQL: users, folders, files,          │       │         │
│  │             db_connections                   │       │         │
│  └──────────────────────┬──────────────────────┘       │         │
│                         │                               │         │
│                         ▼                               ▼         │
│               ┌──────────────┐              ┌──────────────────┐ │
│               │  Local Disk   │              │  External PG DB   │ │
│               │  /uploads/    │              │  (user-provided    │ │
│               │  {userId}/    │              │   credentials)     │ │
│               └──────────────┘              └──────────────────┘ │
│                                                       │          │
│                                              ┌────────┴────────┐ │
│                                              │  OpenAI API      │ │
│                                              │  (optional,      │ │
│                                              │   text-to-SQL)   │ │
│                                              └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 16 (App Router) | API routes eliminate a separate backend; file-system routing matches the page structure |
| Database | PostgreSQL 16 | Recursive CTEs for folder trees, JSONB for cached schemas, robust indexing |
| ORM | Prisma 7 | Type-safe queries, migration system, raw SQL escape hatch for CTEs |
| External DB | `pg` (node-postgres) | Runtime dynamic connections to arbitrary databases |
| File Storage | Local disk (`node:fs`) | Streaming writes via `busboy`, reads via `createReadStream` |
| Image Processing | `sharp` | Server-side thumbnail generation (400x400 JPEG) |
| ZIP Streaming | `archiver` | Streams ZIP archives directly to the client |
| Styling | Tailwind CSS 4 | Utility-first CSS with dark mode support |
| Drag & Drop | Native HTML5 API | Custom implementation using `dataTransfer` and drag events |
| AI | OpenAI GPT-4o-mini | Text-to-SQL generation; graceful fallback when key is absent |
| Testing | Jest + ts-jest | Unit tests for API routes, schema extractor, AI safety |
| CI | GitHub Actions | Lint, type-check, test, and build on every PR |

### Database Schema (ERD)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│    users      │       │   folders     │       │     files         │
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ id (PK)       │◄──┐  │ id (PK)       │◄──┐  │ id (PK)           │
│ email (UQ)    │   │  │ name          │   │  │ name              │
│ name          │   │  │ parent_id (FK)│───┘  │ mime_type          │
│ created_at    │   ├──│ user_id (FK)  │      │ size              │
│               │   │  │ created_at    │   ┌──│ folder_id (FK)    │
└──────────────┘   │  └──────────────┘   │  │ user_id (FK)──────┤
                    │         ▲            │  │ storage_path      │
                    │         │ self-ref   │  │ created_at        │
                    │         └────────────┘  └──────────────────┘
                    │
                    │  ┌──────────────────┐
                    │  │  db_connections    │
                    │  ├──────────────────┤
                    │  │ id (PK)           │
                    │  │ name              │
                    │  │ host / port       │
                    │  │ database_name     │
                    │  │ username          │
                    │  │ encrypted_password│ (AES-256-GCM)
                    │  │ folder_id (FK)────┤──► folders
                    └──│ user_id (FK)      │
                       │ cached_schema     │ (JSONB)
                       │ cached_docs       │ (JSONB)
                       │ last_extracted_at │
                       └──────────────────┘
```

### Key Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_folders_user_parent` | `(user_id, parent_id)` | Fast folder listing within a parent |
| `idx_files_user_folder` | `(user_id, folder_id)` | Fast file listing within a folder |

These composite indexes match the most common query pattern: "list items in folder X for user Y."

---

## API Reference

All endpoints are under `/api/`. Responses use a consistent shape:

**Success:** `{ data: ..., pagination?: { total, limit, offset } }`

**Error:** `{ error: { code, message, status } }`

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files?folderId=&limit=&offset=&sortBy=&sortOrder=` | List files in a folder (paginated) |
| `POST` | `/api/files` | Upload a file (multipart/form-data, streamed via busboy) |
| `GET` | `/api/files/[id]` | Download a file |
| `GET` | `/api/files/[id]/preview` | Preview a file inline |
| `GET` | `/api/files/[id]/thumbnail` | Get a 400x400 JPEG thumbnail (images only) |
| `PATCH` | `/api/files/[id]` | Rename or move a file |
| `DELETE` | `/api/files/[id]` | Delete a file from disk and database |

### Folders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/folders?parentId=&limit=&offset=&sortBy=&sortOrder=` | List subfolders (paginated) |
| `POST` | `/api/folders` | Create a folder |
| `GET` | `/api/folders/tree` | Full folder tree via recursive CTE |
| `GET` | `/api/folders/[id]` | Folder detail with breadcrumbs |
| `GET` | `/api/folders/[id]/download` | Download folder as streamed ZIP |
| `PATCH` | `/api/folders/[id]` | Rename or move (with circular reference check) |
| `DELETE` | `/api/folders/[id]` | Delete folder and all descendants |

### DB Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/db-connections?limit=&offset=&sortBy=&sortOrder=` | List connections (paginated, passwords excluded) |
| `POST` | `/api/db-connections` | Create + test connection |
| `GET` | `/api/db-connections/[id]` | View connection with cached schema |
| `POST` | `/api/db-connections/[id]/extract` | Extract/refresh schema from live DB |
| `POST` | `/api/db-connections/[id]/query` | Natural language to SQL query |
| `DELETE` | `/api/db-connections/[id]` | Delete connection |

### Search & AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?q=&limit=&offset=` | Search files, folders, and DB schemas |
| `GET` | `/api/ai/status` | Check if AI features are enabled |

---

## Design Decisions and Tradeoffs

### Folder Tree: Adjacency List with Recursive CTEs

**Decision:** Folders use a simple `parent_id` self-reference (adjacency list) rather than nested sets or materialized paths.

**Advantage:** Simplest data model. PostgreSQL recursive CTEs (`WITH RECURSIVE`) make reads efficient at any depth — breadcrumbs, descendant enumeration, and circular reference detection all use CTEs.

**Tradeoff:** Moving a subtree is a single `UPDATE` on `parent_id` (cheap), but querying the full tree requires recursion. For very large trees (10,000+ folders), materialized paths would be faster for reads. At the scale of this application, CTEs are more than sufficient.

### Cached Schema as JSONB

**Decision:** Extracted database schemas are stored as a single JSONB column on `db_connections` rather than normalized into separate tables.

**Advantage:** A single read fetches the entire schema. No complex joins. Schema structure (tables, columns, relationships, enums, indexes, interfaces) maps naturally to JSON. Easy to evolve without migrations.

**Tradeoff:** Can't query individual tables or columns via SQL (must fetch and filter client-side). For 200+ table databases the JSONB blob can reach ~1 MB, but PostgreSQL handles this without issue.

### Streaming File Uploads via Busboy

**Decision:** File uploads bypass Next.js's `request.formData()` and instead parse the raw `request.body` ReadableStream with `busboy`, piping file data directly to a `WriteStream` on disk.

**Advantage:** Memory usage is constant regardless of file size. A 100 MB upload uses ~kilobytes of heap, not ~100 MB. Multiple concurrent uploads won't crash the process.

**Tradeoff:** More complex implementation than the simple `formData()` + `arrayBuffer()` approach. Requires `busboy` as a dependency and manual multipart boundary handling.

### Streaming ZIP Downloads

**Decision:** Folder downloads use `archiver` piped through a `ReadableStream` response, with individual files read via `createReadStream` rather than `readFile`.

**Advantage:** Memory usage is bounded by archiver's internal buffers (~hundreds of KB) regardless of folder size. The client starts receiving data immediately rather than waiting for the entire ZIP to be assembled.

**Tradeoff:** No `Content-Length` header (chunked transfer encoding), so the browser can't show download progress as a percentage.

### Server-Side Pagination

**Decision:** All list endpoints (`/api/files`, `/api/folders`, `/api/db-connections`) accept `limit`, `offset`, `sortBy`, and `sortOrder` query parameters. They return `{ data, pagination: { total, limit, offset } }`.

**Advantage:** The database only returns the records needed for the current page. At 10,000 files, the JSON payload is ~12 items instead of ~10,000. The `count()` query runs in parallel with `findMany` for minimal latency overhead.

**Tradeoff:** The file browser combines folders and files in a single paginated view (folders first). The client must compute the correct offset split between the two sources per page, which adds complexity to the front-end pagination logic.

### Thumbnail Generation with Sharp

**Decision:** A `/api/files/[id]/thumbnail` endpoint uses `sharp` to resize images to 400x400 cover-fit JPEG at 75% quality, served with a 24-hour cache header.

**Advantage:** A 5 MB photo becomes a ~30 KB thumbnail. The browser caches it for a day. Grid views load fast even with many image files.

**Tradeoff:** First load incurs a resize computation. `sharp` adds a native binary dependency. SVGs skip the thumbnail endpoint and use the preview endpoint directly since they're already lightweight vectors.

### AES-256-GCM for Database Passwords

**Decision:** External database passwords are encrypted with AES-256-GCM (authenticated encryption with random IVs) rather than hashed.

**Advantage:** Passwords must be decryptable to establish connections — hashing is one-way and won't work. GCM provides both confidentiality and integrity verification. Each encryption produces unique output due to random IVs.

**Tradeoff:** The encryption key (`ENCRYPTION_KEY` env var) is a single point of compromise. If the key leaks, all stored passwords are recoverable. In production, this key should be managed via a secrets manager.

### Read-Only SQL Execution

**Decision:** AI-generated SQL is validated with a keyword blocklist regex, then executed inside a `BEGIN READ ONLY` transaction on the external database.

**Advantage:** Defense in depth — even if prompt injection bypasses the keyword filter, the database rejects mutations at the transaction level.

**Tradeoff:** The regex blocklist is not foolproof (CTEs, `DO` blocks, or function calls could theoretically bypass it). For production use, the external database user's role should be restricted to `SELECT`-only permissions at the PostgreSQL level.

### Single-User Model

**Decision:** A hardcoded `DEFAULT_USER_ID` is used in all API routes instead of implementing authentication.

**Advantage:** Eliminates auth complexity for the demo. Every query includes `WHERE user_id = ...` so the data model is already multi-user ready.

**Tradeoff:** No access control. Adding auth later requires replacing `DEFAULT_USER_ID` references with a `getUserId(request)` helper — the database schema and queries are already prepared for it.

---

## Performance Optimizations

| Optimization | What It Does | Impact |
|-------------|-------------|--------|
| **Server-side pagination** | `take`/`skip` on all list queries; `count()` in parallel | Constant response time and payload size regardless of total records |
| **Composite indexes** | `(user_id, folder_id)` and `(user_id, parent_id)` | Index scans instead of sequential scans for the most common queries |
| **Streaming file upload** | `busboy` parses multipart body → `createWriteStream` | ~constant memory per upload regardless of file size |
| **Streaming ZIP download** | `archiver` → `ReadableStream` response; `createReadStream` per file | ~constant memory per download regardless of folder size |
| **Thumbnail endpoint** | `sharp` resizes to 400x400 JPEG, `Cache-Control: 24h` | ~30 KB per thumbnail vs multi-MB originals; browser caches |
| **Parallel schema extraction** | `Promise.all([tables, relationships, enums, indexes])` | 4 queries run concurrently instead of sequentially |
| **Recursive CTEs** | Breadcrumbs, folder trees, descendant enumeration | Single query handles arbitrary folder depth; no N+1 |
| **Lazy image loading** | `loading="lazy"` on thumbnail `<img>` tags | Only visible cards trigger image requests |
| **Concurrency groups** | CI cancels stale runs on re-push | No wasted compute on outdated code |

---

## Security

| Measure | Details |
|---------|---------|
| **Password encryption** | AES-256-GCM with random IVs. Stored as `iv:tag:ciphertext` (hex). |
| **Read-only queries** | AI-generated SQL runs in `BEGIN READ ONLY` transactions. |
| **SQL safety validation** | Regex blocklist rejects `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`, `EXECUTE`. |
| **Path traversal prevention** | File storage paths use UUIDs (`{userId}/{fileId}-{name}`), not user-supplied paths. |
| **Upload size limits** | Configurable max file size (default 100 MB), enforced during streaming before the file is fully written. Early abort on oversize. |
| **Sensitive data exclusion** | `GET /api/db-connections` list excludes `encryptedPassword` and `cachedSchema` from the response. |
| **Parameterized queries** | All Prisma queries use parameterized templates. Raw `$queryRaw` uses tagged template interpolation. |
| **Circular reference prevention** | Folder moves use a recursive CTE to detect cycles before updating `parent_id`. |

---

## Testing

Run the full suite:

```bash
npm test
```

**57 tests** across 8 test suites:

| Suite | Tests | What's Covered |
|-------|-------|---------------|
| `files/route.test.ts` | 7 | File listing (pagination, limit/offset), streaming upload, validation, folder checks |
| `files/[id].test.ts` | — | Download, rename, move, delete |
| `folders/route.test.ts` | 8 | Folder listing (pagination, limit/offset), create, validation, parent checks |
| `folders/[id].test.ts` | — | Rename, move, circular reference detection, cascading delete |
| `search/route.test.ts` | 3 | Search across files/folders/connections, empty query validation |
| `schema-extractor` | — | Table extraction, relationship detection, enum parsing, index extraction |
| `interfaces.test.ts` | — | PG→TS type mapping, FK resolution, enum union types, optionality |
| `text-to-sql.test.ts` | — | SQL safety validation (mutation keywords, case-insensitivity, subqueries) |

Tests use mocked Prisma and `pg.Pool` — no running database required. Test helpers in `src/test/helpers.ts` provide `createMockPrisma()`, `createMockRequest()`, `createMockPool()`, and sample fixtures.

---

## CI/CD Pipeline

GitHub Actions runs on every push to `main` and on pull requests:

```
┌──────────────┐    ┌──────────┐
│ Lint & Types │    │  Tests   │    ← run in parallel
└──────┬───────┘    └────┬─────┘
       │                 │
       └────────┬────────┘
                ▼
          ┌───────────┐
          │   Build   │              ← only runs if both pass
          └───────────┘
```

| Job | Steps |
|-----|-------|
| **Lint & Type-check** | `npm ci` → `prisma generate` → `eslint .` → `tsc --noEmit` |
| **Tests** | `npm ci` → `prisma generate` → `npm test` |
| **Build** | `npm ci` → `prisma generate` → `npm run build` |

Concurrency groups cancel stale runs when new commits are pushed. Node 20 with npm caching for fast installs.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                         Root layout (fonts, metadata)
│   ├── (dashboard)/
│   │   ├── layout.tsx                     Dashboard shell (Sidebar + main area)
│   │   ├── files/
│   │   │   ├── page.tsx                   Root file browser
│   │   │   └── [folderId]/page.tsx        Subfolder browser
│   │   └── db/
│   │       ├── page.tsx                   All DB connections list
│   │       └── [id]/page.tsx              Schema explorer for a connection
│   └── api/
│       ├── files/
│       │   ├── route.ts                   GET (list, paginated) + POST (streaming upload)
│       │   └── [id]/
│       │       ├── route.ts               GET (download) + PATCH + DELETE
│       │       ├── preview/route.ts       GET (inline preview)
│       │       └── thumbnail/route.ts     GET (sharp-resized JPEG thumbnail)
│       ├── folders/
│       │   ├── route.ts                   GET (list, paginated) + POST (create)
│       │   ├── tree/route.ts              GET (recursive CTE full tree)
│       │   └── [id]/
│       │       ├── route.ts               GET + PATCH + DELETE
│       │       └── download/route.ts      GET (streamed ZIP)
│       ├── db-connections/
│       │   ├── route.ts                   GET (list, paginated) + POST (create + test)
│       │   └── [id]/
│       │       ├── route.ts               GET + DELETE
│       │       ├── extract/route.ts       POST (schema extraction)
│       │       └── query/route.ts         POST (text-to-SQL)
│       ├── search/route.ts               GET (cross-entity search)
│       └── ai/status/route.ts            GET (AI feature flag)
├── lib/
│   ├── db.ts                              Prisma client singleton
│   ├── api-response.ts                    successResponse, paginatedResponse, errorResponse
│   ├── storage.ts                         File I/O (save, delete, read, exists)
│   ├── constants.ts                       DEFAULT_USER_ID, UPLOAD_DIR, MAX_FILE_SIZE
│   ├── encryption.ts                      AES-256-GCM encrypt/decrypt
│   ├── format.ts                          formatSize (bytes → human-readable)
│   ├── types.ts                           Shared TypeScript interfaces (FileItem, FolderItem, etc.)
│   ├── move-item.ts                       Shared move logic for drag-and-drop
│   ├── ai/
│   │   ├── client.ts                      OpenAI client singleton + feature detection
│   │   └── text-to-sql.ts                 SQL generation, safety validation, schema summary
│   └── schema-extractor/
│       ├── index.ts                       extractSchema(), testConnection()
│       ├── types.ts                       ExtractedSchema, Table, Column, etc.
│       ├── tables.ts                      Table + column extraction from information_schema
│       ├── relationships.ts               FK extraction from constraint metadata
│       ├── enums.ts                        Enum extraction from pg_type/pg_enum
│       ├── indexes.ts                     Index extraction from pg_index/pg_class
│       └── interfaces.ts                  PG → TypeScript interface inference
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx                    Folder tree, search, DB connections
│   │   ├── RefreshContext.tsx             Global refresh trigger
│   │   ├── ToastContext.tsx               Toast notification system
│   │   └── DragContext.tsx                Drag-and-drop state
│   ├── files/
│   │   ├── FileBrowserGrid.tsx            Grid view with thumbnail previews
│   │   ├── FileBrowserList.tsx            List/table view
│   │   ├── FileThumbnail.tsx              Image thumbnail + type-specific icons
│   │   └── DropOverlay.tsx                External file drop zone
│   ├── schema/
│   │   ├── TablesTab.tsx                  Tables tab with column detail
│   │   ├── RelationshipsTab.tsx           FK relationships tab
│   │   ├── EnumsTab.tsx                   Enums tab
│   │   ├── IndexesTab.tsx                 Indexes tab
│   │   ├── InterfacesTab.tsx              TypeScript interfaces tab
│   │   ├── SchemaDiagram.tsx              ReactFlow ER diagram
│   │   └── usePaginatedFilter.ts          Reusable search + pagination hook
│   ├── ui/
│   │   ├── Pagination.tsx                 Pagination controls
│   │   ├── SortSelect.tsx                 Sort dropdown
│   │   ├── ViewToggle.tsx                 Grid/list toggle
│   │   ├── Modal.tsx                      Base modal component
│   │   ├── ConfirmDialog.tsx              Confirmation dialog
│   │   ├── PromptDialog.tsx               Text input dialog
│   │   ├── UploadDialog.tsx               File upload dialog
│   │   ├── AddConnectionDialog.tsx        DB connection form
│   │   ├── ContextMenu.tsx                Right-click context menu
│   │   └── useDialog.ts                   Promise-based dialog hooks
│   └── icons/index.tsx                    Shared SVG icon components
├── hooks/
│   ├── useItemActions.ts                  File/folder CRUD actions with dialogs
│   └── useFileDragDrop.ts                 Drag-and-drop event handlers
├── test/
│   └── helpers.ts                         Mock factories and sample fixtures
└── generated/prisma/                      Auto-generated Prisma client (gitignored)
```

## AI Usage
I built this project by leveraging Claude Opus 4.6 with thinking mode to handle architectural decisions, boilerplate code, general tedious implementation, and code optimization. I first used Claude to generate an initial design doc `DESIGN.md` by describing general app features and goals as a starting point, simply a hosted file system and schema extractor using Nextjs and Postgres. I then refined the design plan by laying out more specific expectations and constraints, such as specific features that would require their own API routes and performance expectations for file upload/download. Once I was satisfied with the plan, I used Claude Code to generate a minimal working implementation with only bare bone priority features (basic CRUD APIs, minimal frontend for testing) along with appropriate tests. After some manual code fixes, this initial prototype supported schema extraction into one large data dump and basic folder/file operations. I then iterated upon it incrementally adding features such as each of the schema extractor tabs. This way if I ever needed Claude assistance on anything, I could avoid overloading its context and review and revise small batches of generated code at a time. Finally with the entire app complete, I had Claude review the entire codebase to identify any issues or room for optimization in implementation, code quality, scalability, and security (`CODEBASE_ASSESSMENT.md`), especially within generated code. I refactored and fixed any bad code accordingly.
