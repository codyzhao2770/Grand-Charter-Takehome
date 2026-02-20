# DataVault — Design Document

## 1. Overview

DataVault is a unified data management platform that combines two capabilities:

1. **Hosted File System** — Upload, organize, preview, search, and drag-and-drop files and folders (like Google Drive).
2. **Database Schema Explorer** — Connect to external PostgreSQL databases, extract their full schema (tables, relationships, enums, indexes, inferred TypeScript interfaces), browse it visually, and run natural-language-to-SQL queries.

The unifying concept: database connections are **first-class items inside the file system**. A user can create a DB connection inside any folder, right alongside their files. This makes the two prompts feel like one product, not two bolted-together features.

### Tech Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14+ (App Router) | Server components for read-heavy views, API routes eliminate separate backend, server actions for mutations |
| Database | PostgreSQL 16 | Recursive CTEs for folder trees, GIN-indexed full-text search, JSONB for cached schemas |
| ORM | Prisma | Type-safe queries, migration system, raw SQL escape hatch for CTEs and FTS |
| External DB | `pg` (node-postgres) | Runtime dynamic connections to arbitrary databases — Prisma can't do this |
| File Storage | Local disk (`node:fs`) | No premade file management libraries per prompt constraints |
| Styling | Tailwind CSS + shadcn/ui | Rapid iteration; shadcn is copy-pasted components (not a file management library) |
| Drag & Drop | Native HTML5 API | Custom implementation satisfies the "no premade libraries" constraint |
| Auth | NextAuth.js (optional) | Session management; can be replaced with a simple cookie if auth isn't assessed |
| AI | OpenAI GPT-4o-mini | Text-to-SQL, schema docs, semantic search, interface enhancement |
| Containerization | Docker Compose | One-command setup for reviewers |

---

## 2. Architecture

### 2.1 High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ File Explorer │  │ Schema Viewer│  │ Search / Query Runner  │  │
│  │  (drag/drop,  │  │  (tree view, │  │  (full-text search,    │  │
│  │   upload,     │  │   table      │  │   text-to-SQL)         │  │
│  │   preview)    │  │   detail,    │  │                        │  │
│  │              │  │   graph)     │  │                        │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
│         │                 │                       │               │
└─────────┼─────────────────┼───────────────────────┼───────────────┘
          │ HTTP/fetch       │ HTTP/fetch             │ HTTP/fetch
          ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Server (API Routes)                    │
│                                                                   │
│  ┌────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ /api/files  │ │/api/folders   │ │/api/search│ │/api/db-conn  │  │
│  │ /api/files/ │ │/api/folders/  │ │          │ │/api/db-conn/ │  │
│  │  [id]       │ │  [id]        │ │          │ │  [id]/extract│  │
│  │  [id]/prev  │ │  /tree       │ │          │ │  [id]/query  │  │
│  └──────┬──────┘ └──────┬───────┘ └────┬─────┘ └──────┬───────┘  │
│         │               │              │               │          │
│         ▼               ▼              ▼               │          │
│  ┌─────────────────────────────────────────────┐       │          │
│  │           Prisma ORM (App Database)          │       │          │
│  │  PostgreSQL: users, folders, files,          │       │          │
│  │             db_connections                   │       │          │
│  └──────────────────────┬──────────────────────┘       │          │
│                         │                               │          │
│                         ▼                               ▼          │
│               ┌──────────────┐              ┌──────────────────┐  │
│               │  Local Disk   │              │  External PG DB   │  │
│               │  /uploads/    │              │  (user-provided   │  │
│               │  {userId}/    │              │   credentials)    │  │
│               │  {fileId}-name│              │                   │  │
│               └──────────────┘              └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Request Flow Examples

**File Upload:**
```
Client → POST /api/files (multipart/form-data)
  → Parse FormData, extract File blob
  → Generate UUID, compute storage path
  → fs.mkdir (recursive) → fs.writeFile (stream to disk)
  → prisma.file.create (save metadata)
  → Return JSON response with file metadata
```

**Move File via Drag-and-Drop:**
```
Client → PATCH /api/files/[fileId] { folderId: "target-folder-id" }
  → Validate target folder exists and belongs to user
  → Validate no circular reference (for folder moves)
  → prisma.file.update({ folderId })
  → Return updated file
  → Client: optimistic UI already updated, reconcile if needed
```

**Schema Extraction:**
```
Client → POST /api/db-connections/[id]/extract
  → Decrypt stored password
  → new Pool(connectionConfig) → connect to external DB
  → Promise.all([extractTables, extractRelationships, extractEnums, extractIndexes])
  → inferInterfaces(tables, relationships)
  → prisma.dbConnection.update({ cachedSchema: result })
  → pool.end() (always, via finally)
  → Return extracted schema JSON
```

---

## 3. Database Design

### 3.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│    users      │       │   folders     │       │     files         │
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ id (PK)       │◄──┐  │ id (PK)       │◄──┐  │ id (PK)           │
│ email (UQ)    │   │  │ name          │   │  │ name              │
│ name          │   │  │ parent_id (FK)│───┘  │ mime_type          │
│ password_hash │   ├──│ user_id (FK)  │      │ size              │
│ created_at    │   │  │ created_at    │   ┌──│ folder_id (FK)    │
└──────────────┘   │  │ updated_at    │   │  │ user_id (FK)──────┤
                    │  │ search_vector │   │  │ storage_path      │
                    │  └──────────────┘   │  │ created_at        │
                    │         ▲            │  │ updated_at        │
                    │         │            │  │ search_vector     │
                    │         └────────────┘  └──────────────────┘
                    │
                    │  ┌──────────────────┐
                    │  │  db_connections    │
                    │  ├──────────────────┤
                    │  │ id (PK)           │
                    │  │ name              │
                    │  │ host              │
                    │  │ port              │
                    │  │ database_name     │
                    │  │ username          │
                    │  │ encrypted_password│
                    │  │ folder_id (FK)────┤──► folders
                    └──│ user_id (FK)      │
                       │ cached_schema     │ (JSONB)
                       │ last_extracted_at │
                       │ created_at        │
                       └──────────────────┘
```

### 3.2 Key Schema Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Folder tree structure | Adjacency list (`parent_id` self-reference) | Simplest model; PostgreSQL recursive CTEs make reads efficient. Nested sets or materialized paths add complexity we don't need. |
| Root-level items | `parent_id IS NULL` / `folder_id IS NULL` | Null means "at root." Avoids a synthetic root folder row. |
| Cascade deletes | `ON DELETE CASCADE` on `parent_id` | Deleting a parent folder deletes all descendants — expected file system behavior. |
| Full-text search | Generated `tsvector` column + GIN index | Always in sync (no triggers needed), GIN index makes `@@` queries fast at scale. |
| Schema caching | `cached_schema JSONB` on `db_connections` | Avoids re-extracting on every page load. User explicitly refreshes. JSONB allows querying inside cached data. |
| Password storage | AES-256-GCM encryption (not hashing) | DB passwords must be decrypted to connect — hashing is one-way and won't work. App-level encryption key in env var. |

### 3.3 Indexes

```sql
-- Tree traversal
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_user ON folders(user_id);

-- File listing within a folder
CREATE INDEX idx_files_folder ON files(folder_id);
CREATE INDEX idx_files_user ON files(user_id);

-- Full-text search (GIN for inverted index)
CREATE INDEX idx_files_search ON files USING GIN(search_vector);
CREATE INDEX idx_folders_search ON folders USING GIN(search_vector);

-- Composite index for the most common query: "list items in folder X for user Y"
CREATE INDEX idx_files_user_folder ON files(user_id, folder_id);
CREATE INDEX idx_folders_user_parent ON folders(user_id, parent_id);
```

The composite indexes on `(user_id, folder_id)` and `(user_id, parent_id)` are critical for performance — every query in the app filters by `user_id` first, then by location.

---

## 4. API Design

All endpoints are under `/api/`. Auth is enforced via middleware (session cookie or JWT).

### 4.1 Files API

| Method | Endpoint | Body / Params | Response | Notes |
|--------|----------|--------------|----------|-------|
| `GET` | `/api/files?folderId=X` | Query: `folderId` (optional, null=root) | `File[]` | Lists files in a folder |
| `POST` | `/api/files` | `FormData: { file, folderId? }` | `File` | Upload a file. Streams to disk. |
| `GET` | `/api/files/[id]` | — | Binary stream | Download file. Sets `Content-Disposition: attachment`. |
| `GET` | `/api/files/[id]/preview` | — | Binary stream | Preview file. Sets `Content-Disposition: inline`. |
| `PATCH` | `/api/files/[id]` | `{ name?, folderId? }` | `File` | Rename or move a file. |
| `DELETE` | `/api/files/[id]` | — | `{ success: true }` | Deletes from disk AND database. |

### 4.2 Folders API

| Method | Endpoint | Body / Params | Response | Notes |
|--------|----------|--------------|----------|-------|
| `GET` | `/api/folders?parentId=X` | Query: `parentId` (optional, null=root) | `Folder[]` | Lists subfolders |
| `POST` | `/api/folders` | `{ name, parentId? }` | `Folder` | Create a folder |
| `GET` | `/api/folders/tree` | — | `TreeNode[]` | Full folder tree via recursive CTE |
| `PATCH` | `/api/folders/[id]` | `{ name?, parentId? }` | `Folder` | Rename or move. **Must validate no circular reference.** |
| `DELETE` | `/api/folders/[id]` | — | `{ success: true }` | Cascades to children (DB handles this). Must also delete files from disk. |

### 4.3 DB Connections API

| Method | Endpoint | Body / Params | Response | Notes |
|--------|----------|--------------|----------|-------|
| `GET` | `/api/db-connections` | — | `DbConnection[]` | List all connections (passwords excluded) |
| `POST` | `/api/db-connections` | `{ name, host, port, database, username, password, folderId? }` | `DbConnection` | Create + test connection. Encrypt password before storing. |
| `GET` | `/api/db-connections/[id]` | — | `DbConnection` with `cachedSchema` | View cached schema |
| `POST` | `/api/db-connections/[id]/extract` | — | `ExtractedSchema` | Re-extract schema from live DB. Updates cache. |
| `POST` | `/api/db-connections/[id]/query` | `{ naturalLanguage: string }` | `{ sql: string, results: Row[], columns: string[] }` | Text-to-SQL: parse query, execute on external DB, return results |
| `DELETE` | `/api/db-connections/[id]` | — | `{ success: true }` | Delete connection (no external DB changes) |

### 4.4 Search API

| Method | Endpoint | Body / Params | Response | Notes |
|--------|----------|--------------|----------|-------|
| `GET` | `/api/search?q=term` | Query: `q` (required) | `SearchResult[]` | Searches files, folders, and cached schemas. Results ranked by `ts_rank`. |

### 4.5 Error Response Format

All errors return a consistent shape:

```json
{
  "error": {
    "code": "FOLDER_NOT_FOUND",
    "message": "Folder with id abc-123 does not exist",
    "status": 404
  }
}
```

Error codes used:
- `VALIDATION_ERROR` (400) — missing/invalid fields
- `UNAUTHORIZED` (401) — no session
- `FORBIDDEN` (403) — resource belongs to another user
- `NOT_FOUND` (404) — resource doesn't exist
- `CONFLICT` (409) — circular folder reference, duplicate name
- `PAYLOAD_TOO_LARGE` (413) — file exceeds size limit
- `CONNECTION_FAILED` (422) — can't connect to external DB
- `INTERNAL_ERROR` (500) — unexpected server failure

---

## 5. Schema Extraction Engine

This is the core of Prompt 2. The extractor connects to an external PostgreSQL database and pulls out everything.

### 5.1 Extraction Queries

**Tables & Columns** (`schema-extractor/tables.ts`):
```sql
SELECT
  t.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,                          -- actual PG type (e.g., 'int4' vs 'integer')
  c.is_nullable,
  c.column_default,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale
FROM information_schema.tables t
JOIN information_schema.columns c
  ON t.table_name = c.table_name
  AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
```

**Row Count Estimates** (fast, no sequential scan):
```sql
SELECT
  relname AS table_name,
  reltuples::bigint AS row_count_estimate
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Relationships / Foreign Keys** (`schema-extractor/relationships.ts`):
```sql
SELECT
  tc.constraint_name,
  tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_name AS target_table,
  ccu.column_name AS target_column,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
```

**Enums** (`schema-extractor/enums.ts`):
```sql
SELECT
  t.typname AS enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname;
```

**Indexes** (`schema-extractor/indexes.ts`):
```sql
SELECT
  i.relname AS index_name,
  t.relname AS table_name,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary,
  array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
  am.amname AS index_type        -- btree, hash, gin, gist, etc.
FROM pg_index ix
JOIN pg_class i ON ix.indexrelid = i.oid
JOIN pg_class t ON ix.indrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
JOIN pg_am am ON i.relam = am.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE n.nspname = 'public'
GROUP BY i.relname, t.relname, ix.indisunique, ix.indisprimary, am.amname;
```

### 5.2 Interface Inference

The prompt asks for "interfaces — objects used in code but not necessarily defined by schema." This means generating TypeScript interfaces from table schemas.

**Mapping rules:**

| PostgreSQL Type | TypeScript Type |
|----------------|-----------------|
| `int2`, `int4`, `int8`, `float4`, `float8`, `numeric`, `decimal` | `number` |
| `varchar`, `text`, `char`, `uuid`, `citext` | `string` |
| `bool` | `boolean` |
| `timestamp`, `timestamptz`, `date` | `Date` |
| `json`, `jsonb` | `Record<string, unknown>` |
| `_int4`, `_text`, etc. (arrays) | `number[]`, `string[]`, etc. |
| Custom enum type | Union literal type (`'active' \| 'inactive' \| 'suspended'`) |

**Relation inference:**
- A column with a FK to another table → property of that table's interface type
- Another table has a FK pointing back → array property (one-to-many)

**Example output** for a `users` table with `orders`:
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  // Inferred relations
  orders: Order[];  // orders.user_id → users.id
}

interface Order {
  id: string;
  total: number;
  status: 'pending' | 'paid' | 'shipped';  // from pg enum
  user_id: string;
  created_at: Date;
  // Inferred relations
  user: User;  // FK: user_id → users.id
}
```

### 5.3 Extracted Schema JSON Shape

```typescript
interface ExtractedSchema {
  tables: {
    name: string;
    columns: {
      name: string;
      type: string;           // raw PG type
      tsType: string;         // mapped TypeScript type
      nullable: boolean;
      defaultValue: string | null;
      isPrimaryKey: boolean;
      isForeignKey: boolean;
      references?: { table: string; column: string };
      maxLength?: number;
    }[];
    primaryKey: string[];
    rowCountEstimate: number;
  }[];
  relationships: {
    name: string;             // constraint name
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    onUpdate: string;
    onDelete: string;
  }[];
  enums: {
    name: string;
    values: string[];
  }[];
  indexes: {
    name: string;
    tableName: string;
    columns: string[];
    isUnique: boolean;
    isPrimary: boolean;
    type: string;             // btree, gin, gist, etc.
  }[];
  interfaces: {
    name: string;             // PascalCase of table name
    properties: {
      name: string;           // camelCase of column name
      type: string;           // TypeScript type string
      optional: boolean;      // true if nullable and no default
    }[];
    relations: {
      name: string;
      type: string;           // e.g., "User" or "Order[]"
      relation: 'belongsTo' | 'hasMany' | 'hasOne';
      foreignKey: string;
    }[];
  }[];
  metadata: {
    extractedAt: string;
    databaseName: string;
    schemaName: string;
    tableCount: number;
    totalEstimatedRows: number;
  };
}
```

Users can download this entire object as a `.json` file from the schema viewer.

---

## 6. Frontend Architecture

### 6.1 Page Structure

```
/ (redirect to /files)
├── /login
├── /register
├── /files                          ← root-level file explorer
│   └── /files/[folderId]          ← folder contents
├── /db/[connectionId]             ← schema explorer
│   └── /db/[connectionId]/query   ← text-to-SQL runner
└── /search?q=...                  ← search results
```

### 6.2 Layout & Navigation

```
┌─────────────────────────────────────────────────────────┐
│ ┌─────────┐  ┌─────────────────────────────────────────┐│
│ │ SIDEBAR  │  │ TOPBAR: [Search..................] [User]││
│ │          │  ├─────────────────────────────────────────┤│
│ │ 📁 Files │  │ Breadcrumbs: Home > Projects > Backend  ││
│ │  📁 Proj │  ├─────────────────────────────────────────┤│
│ │   📁 Be  │  │                                         ││
│ │   📁 Fr  │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐          ││
│ │  📁 Docs │  │  │File│ │File│ │Fldr│ │ DB │          ││
│ │          │  │  │    │ │    │ │    │ │Conn│          ││
│ │ 🔌 DBs   │  │  └────┘ └────┘ └────┘ └────┘          ││
│ │  🔌 Stag │  │                                         ││
│ │  🔌 Prod │  │  ┌────┐ ┌────┐                         ││
│ │          │  │  │File│ │File│                          ││
│ └─────────┘  │  └────┘ └────┘                         ││
│              └─────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Sidebar** — Collapsible folder tree (loaded via recursive CTE). DB connections appear inline in their parent folders. Clicking a folder navigates to `/files/[folderId]`. Clicking a DB connection navigates to `/db/[connectionId]`.

**Topbar** — Global search bar with debounced input (300ms). Navigates to `/search?q=...` on submit or shows a dropdown with instant results.

**Breadcrumbs** — Derived from the folder path. Requires a query to get ancestor chain:
```sql
WITH RECURSIVE ancestors AS (
  SELECT id, name, parent_id FROM folders WHERE id = $1
  UNION ALL
  SELECT f.id, f.name, f.parent_id
  FROM folders f
  JOIN ancestors a ON f.id = a.parent_id
)
SELECT * FROM ancestors ORDER BY id; -- reverse to get root-first
```

### 6.3 Component Tree & State

```
<RootLayout>
  <AuthProvider>                      ← session context
    <DashboardLayout>
      <Sidebar>
        <FolderTree />               ← server component, fetches tree via CTE
      </Sidebar>
      <Topbar>
        <SearchBar />                ← client component, useDebounce
      </Topbar>
      <main>
        {children}                   ← page content
      </main>
    </DashboardLayout>
  </AuthProvider>
</RootLayout>
```

**State management approach:** No global store (Redux/Zustand). Instead:

1. **Server state** — React Server Components fetch data directly. Revalidated via `revalidatePath()` after mutations.
2. **Client interactivity** — Where needed (drag-and-drop, upload progress, search input), use local `useState` / `useReducer` within client components.
3. **Optimistic updates** — For move/rename operations, use `useOptimistic` to update the UI immediately, then reconcile when the server responds.
4. **Drag-and-drop context** — A `DragProvider` context wraps the file explorer to share drag state between `Draggable` items and `DropTarget` folders.

### 6.4 Drag-and-Drop Implementation

The DnD system uses native HTML5 drag events wrapped in React components.

**Components:**
- `DragProvider` — Context that holds `draggedItem`, `dropTargetId`, and handlers
- `Draggable` — Wraps any file/folder card; sets `draggable={true}`, binds `onDragStart`/`onDragEnd`
- `DropTarget` — Wraps any folder; binds `onDragOver`/`onDragLeave`/`onDrop`, shows highlight ring when hovered

**Flow:**
1. User starts dragging a `FileCard` → `onDragStart` stores `{ id, type: 'file' | 'folder' }` in `dataTransfer`
2. User drags over a folder → `onDragOver` calls `e.preventDefault()` (required to allow drop), sets visual feedback (blue ring)
3. User drops → `onDrop` reads the data, calls `PATCH /api/files/[id]` or `PATCH /api/folders/[id]` with new `folderId`/`parentId`
4. Optimistic UI: item disappears from source, appears in target immediately

**Preventing invalid drops:**
- A folder cannot be dropped into itself (check `draggedItem.id !== targetFolderId`)
- A folder cannot be dropped into one of its descendants (requires checking the ancestor chain — API validates this server-side with a recursive query)
- Files cannot be a drop target

**External file upload via drag:**
- The file explorer area is also a drop zone for files from the OS
- `onDrop` checks `e.dataTransfer.files` — if it contains `File` objects (not JSON), trigger upload flow

### 6.5 File Preview

| MIME Type | Preview Strategy |
|-----------|-----------------|
| `image/*` | `<img>` tag with `src=/api/files/[id]/preview` |
| `text/*`, `application/json`, `application/javascript` | Fetch content as text, render in a `<pre>` block with syntax highlighting (optional) |
| `application/pdf` | `<iframe src=/api/files/[id]/preview>` |
| `video/*`, `audio/*` | Native `<video>` / `<audio>` element with `src` |
| Everything else | Download button only, no inline preview |

Preview opens in a modal dialog (`shadcn Dialog`). The preview API route streams the file with `Content-Type` set correctly and `Content-Disposition: inline`.

### 6.6 Schema Explorer UI

The schema viewer at `/db/[connectionId]` has three panels:

```
┌──────────────────────────────────────────────────────────────┐
│  [< Back to Files]   DB: staging_clone   [Refresh] [Export] │
├──────────────┬───────────────────────────────────────────────┤
│  TABLE LIST  │  TABLE DETAIL                                 │
│              │                                               │
│  > users     │  Table: users (≈12,340 rows)                  │
│  > orders  ◄─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─            │
│  > products  │  Columns:                                     │
│  > payments  │  ┌──────────┬──────────┬──────┬─────────┐    │
│  > ...       │  │ Name     │ Type     │ Null │ Default │    │
│              │  ├──────────┼──────────┼──────┼─────────┤    │
│  ENUMS       │  │ id       │ uuid     │ NO   │ gen_... │    │
│  > status    │  │ email    │ varchar  │ NO   │         │    │
│  > role      │  │ name     │ text     │ NO   │         │    │
│              │  └──────────┴──────────┴──────┴─────────┘    │
│  INTERFACES  │                                               │
│  > User      │  Indexes:                                     │
│  > Order     │  - users_pkey (PRIMARY, btree: [id])          │
│  > Product   │  - users_email_key (UNIQUE, btree: [email])   │
│              │                                               │
│              │  Relationships:                                │
│              │  - orders.user_id → users.id                   │
│              │  - payments.user_id → users.id                 │
│              │                                               │
│              │  Interface:                                    │
│              │  interface User {                              │
│              │    id: string;                                 │
│              │    email: string;                              │
│              │    name: string;                               │
│              │    orders: Order[];                            │
│              │    payments: Payment[];                        │
│              │  }                                            │
└──────────────┴───────────────────────────────────────────────┘
```

- **Table List** — Clickable list. Selecting a table shows its detail.
- **Table Detail** — Columns, indexes, relationships, and inferred interface for the selected table.
- **Export** — Downloads the entire `ExtractedSchema` as a JSON file.
- **Refresh** — Re-runs extraction against the live database, updates `cached_schema`.

### 6.7 Text-to-SQL Query Runner

At `/db/[connectionId]/query`:

```
┌──────────────────────────────────────────────────────────────┐
│  Natural Language Query:                                      │
│  ┌────────────────────────────────────────────────────┐      │
│  │ Show me all users who placed more than 5 orders    │      │
│  └────────────────────────────────────────────────────┘      │
│  [Run Query]                                                  │
│                                                               │
│  Generated SQL:                                               │
│  ┌────────────────────────────────────────────────────┐      │
│  │ SELECT u.id, u.name, u.email, COUNT(o.id) AS cnt  │      │
│  │ FROM users u                                       │      │
│  │ JOIN orders o ON o.user_id = u.id                  │      │
│  │ GROUP BY u.id, u.name, u.email                     │      │
│  │ HAVING COUNT(o.id) > 5                             │      │
│  │ ORDER BY cnt DESC;                                 │      │
│  └────────────────────────────────────────────────────┘      │
│  [Edit SQL] [Copy]                                           │
│                                                               │
│  Results (23 rows):                                           │
│  ┌──────┬──────────────┬──────────────────────┬─────┐       │
│  │ id   │ name         │ email                │ cnt │       │
│  ├──────┼──────────────┼──────────────────────┼─────┤       │
│  │ a1b2 │ Alice Smith  │ alice@example.com    │  12 │       │
│  │ c3d4 │ Bob Jones    │ bob@example.com      │   8 │       │
│  │ ...  │ ...          │ ...                  │ ... │       │
│  └──────┴──────────────┴──────────────────────┴─────┘       │
└──────────────────────────────────────────────────────────────┘
```

**Implementation approach — OpenAI-powered (primary) with pattern-matching fallback:**

The text-to-SQL engine uses GPT-4o-mini as the primary strategy. The cached schema is compressed into a context prompt, and the model generates SQL with high accuracy for complex queries.

**GPT-4o-mini flow:**

1. Build a schema summary prompt from `cachedSchema`:
   ```
   Tables:
   - users (id uuid PK, email varchar, name text, created_at timestamp)
   - orders (id uuid PK, user_id uuid FK→users.id, total numeric, status order_status, created_at timestamp)
   - order_items (id uuid PK, order_id uuid FK→orders.id, product_id uuid FK→products.id, quantity int, price numeric)
   ...
   Enums:
   - order_status: 'pending', 'paid', 'shipped', 'delivered'
   ```

2. Send to OpenAI:
   ```typescript
   const response = await openai.chat.completions.create({
     model: 'gpt-4o-mini',
     messages: [
       {
         role: 'system',
         content: `You are a PostgreSQL query generator. Given a database schema and a natural language question, generate a single SELECT query. Rules:
   - Only SELECT statements (never INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE)
   - Use proper JOINs based on foreign key relationships
   - Use table aliases for readability
   - Add ORDER BY and LIMIT when appropriate
   - Return ONLY the SQL, no explanation or markdown`
       },
       {
         role: 'user',
         content: `Schema:\n${schemaSummary}\n\nQuestion: ${userQuery}`
       }
     ],
     temperature: 0,
     max_tokens: 500,
   });
   ```

3. **Validate the output** before execution:
   - Parse the response and reject if it contains mutation keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`)
   - Wrap in a read-only transaction: `BEGIN READ ONLY; {query}; ROLLBACK;`

4. Execute the validated SQL on the external DB and return results.

**Fallback (no API key):** If `OPENAI_API_KEY` is not set, fall back to a keyword/pattern matcher:
- Match words against table/column names
- Detect aggregation keywords ("count", "sum", "average")
- Detect filter patterns ("more than", "before", number literals)
- Auto-join via FK relationships in the cached schema

**Cost note:** GPT-4o-mini is ~$0.15/1M input tokens, ~$0.60/1M output tokens. A schema summary + query is typically <2K tokens. This means ~500 queries cost ~$0.15 — negligible for a take-home demo.

**Safety:** All queries are executed on the read-only clone. Additionally, the query runner rejects any query containing mutation keywords as a defense-in-depth measure, and wraps execution in a read-only transaction.

---

## 7. Security

### 7.1 Authentication & Authorization

- **Auth:** NextAuth.js with credentials provider (email + bcrypt-hashed password).
- **Session:** JWT stored in HTTP-only cookie. Middleware checks for valid session on all `/api/*` and `/(dashboard)/*` routes.
- **Authorization:** Every API route verifies `resource.userId === session.userId`. No access to other users' files/folders/connections. This is enforced at the query level (`WHERE user_id = $userId`).

### 7.2 External DB Password Encryption

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, encryptedHex] = stored.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8');
}
```

### 7.3 File Upload Security

- **Size limit:** Configurable max file size (default 100MB), enforced in API route before writing to disk.
- **Path traversal prevention:** File names are sanitized; storage paths use UUIDs, not user-supplied names.
- **MIME type validation:** Optional allowlist for upload. At minimum, the original `file.type` is stored but the storage path uses the file ID, preventing executable file attacks.

### 7.4 SQL Injection Prevention

- All Prisma queries use parameterized queries (template literals with `$queryRaw` interpolation).
- External DB queries in the schema extractor use `pg` parameterized queries.
- The text-to-SQL runner: generated SQL is executed on a **read-only** database connection. Additionally, queries are scanned for mutation keywords before execution.

---

## 8. Performance & Stress Test Considerations

The prompt says "stress tests" — here's how the design handles scale.

### 8.1 1000+ Files in a Single Folder

- **Query:** `SELECT * FROM files WHERE user_id = $1 AND folder_id = $2 ORDER BY name LIMIT 50 OFFSET $3`
- **Index:** `idx_files_user_folder` makes this a fast index scan even at 10,000+ files.
- **UI:** Paginate or virtualize. Rendering 1000 DOM nodes kills performance. Use either:
  - **Pagination** — Load 50 items at a time, "Load More" button (simpler)
  - **Virtualization** — Only render visible items using `position: absolute` and scroll offset calculation (better UX, more complex). Since we can't use a premade library like `react-window`, a custom implementation with `IntersectionObserver` or scroll event listeners works.

### 8.2 Deeply Nested Folders (10+ Levels)

- **Query:** The recursive CTE handles arbitrary depth. The `depth` column in the CTE result lets the frontend render indentation.
- **Sidebar:** Lazy-load subtrees — initially only show top-level folders. Expand on click (fetch children). Or fetch entire tree upfront if the total folder count is reasonable (<500).
- **Breadcrumbs:** The ancestor CTE query handles any depth.

### 8.3 Large File Uploads (100MB+)

- **Streaming:** Don't buffer the entire file in memory. Use `request.formData()` which Next.js handles, but for very large files, consider chunked uploads:
  - Client splits file into 5MB chunks
  - Each chunk uploaded via `POST /api/files/chunk` with `{ fileId, chunkIndex, totalChunks }`
  - Server appends chunks to a temp file
  - Final request merges chunks (or just writes sequentially)
- **Progress:** Track upload progress client-side via `XMLHttpRequest` (or `fetch` with `ReadableStream`) and display a progress bar.
- **Timeout:** Set appropriate Next.js API route config: `export const config = { api: { bodyParser: { sizeLimit: '100mb' } } }` (or App Router equivalent with `export const runtime = 'nodejs'`).

### 8.4 Databases with 200+ Tables

- **Extraction time:** `Promise.all` for parallel queries keeps extraction fast. Each query hits `information_schema`/`pg_catalog` which are well-indexed. 200 tables should extract in <2 seconds.
- **Schema viewer:** Virtualize the table list if needed. The table detail panel only loads data for the selected table.
- **Cached schema JSONB:** For 200 tables, the JSONB blob might be 500KB-1MB. PostgreSQL handles this fine. Frontend receives it once and navigates client-side.

### 8.5 Concurrent Operations

- **File move conflicts:** If two users (or tabs) move the same file simultaneously, last-write-wins is acceptable for a take-home. For robustness, use `updatedAt` optimistic locking:
  ```sql
  UPDATE files SET folder_id = $1, updated_at = NOW()
  WHERE id = $2 AND updated_at = $3
  ```
  If 0 rows affected, return 409 Conflict.

---

## 9. Folder Deletion — Cascading Disk Cleanup

Deleting a folder is the trickiest operation because we need to:
1. Delete all descendant files from **disk**
2. Delete all database records (handled by `ON DELETE CASCADE`)

**Approach:**
```typescript
async function deleteFolder(folderId: string, userId: string) {
  // 1. Get all files in this folder and all descendant folders
  const files = await prisma.$queryRaw`
    WITH RECURSIVE descendant_folders AS (
      SELECT id FROM folders WHERE id = ${folderId} AND user_id = ${userId}
      UNION ALL
      SELECT f.id FROM folders f
      JOIN descendant_folders df ON f.parent_id = df.id
    )
    SELECT storage_path FROM files
    WHERE folder_id IN (SELECT id FROM descendant_folders)
  `;

  // 2. Delete files from disk
  await Promise.all(
    files.map(f => fs.unlink(f.storage_path).catch(() => {})) // ignore if already deleted
  );

  // 3. Delete folder from DB — CASCADE handles folders, files, db_connections
  await prisma.folder.delete({ where: { id: folderId } });
}
```

---

## 10. Implementation Priorities

Ordered by what delivers the most demo-able value earliest:

| Priority | Feature | Why First |
|----------|---------|-----------|
| **P0** | Project setup (Next.js, Prisma, PostgreSQL, Docker) | Everything depends on this |
| **P0** | Database schema + migrations + seed data | Need the foundation |
| **P1** | Folder CRUD + folder tree API | Core navigation |
| **P1** | File upload + download + metadata API | Core functionality |
| **P1** | File explorer UI (grid view, click-to-navigate) | Makes it look like a product |
| **P1** | Breadcrumb navigation | Essential for UX |
| **P2** | Drag-and-drop (move files/folders) | Key differentiator from prompt |
| **P2** | File preview (images, text, PDF) | Shows completeness |
| **P2** | Full-text search | Required by prompt |
| **P2** | Context menu (rename, move, delete) | Expected UX |
| **P3** | DB connection form + credential storage | Starts prompt 2 |
| **P3** | Schema extraction engine (all 5 modules) | Core of prompt 2 |
| **P3** | Schema viewer UI | Makes extraction useful |
| **P3** | Schema JSON export | Required by prompt |
| **P3** | OpenAI client setup (`lib/ai/client.ts`) | Unlocks all AI features |
| **P3** | AI-powered text-to-SQL query runner | High-impact add-on, directly requested in prompt |
| **P3** | AI schema auto-documentation | Enriches schema viewer significantly |
| **P4** | AI semantic search | Enhances search beyond keyword matching |
| **P4** | AI-enhanced interface generation (JSDoc, utility types) | Polish on schema export |
| **P4** | AI smart folder suggestion on upload | Nice UX touch |
| **P4** | AI suggested queries for schema explorer | Discovery feature |
| **P4** | Relationship visualization | Polish |
| **P4** | Auth (login/register) | Nice to have, not critical |
| **P4** | Upload progress, chunked uploads | Stress test prep |

---

## 11. File & Folder Naming in Storage

```
uploads/
├── {userId}/
│   ├── {fileId}-original-name.pdf
│   ├── {fileId}-photo.jpg
│   └── {fileId}-report.xlsx
```

- UUIDs in the path prevent collisions even if multiple files share the same name.
- Original file name preserved in the path suffix for debugging, but the canonical name is in the database.
- User-scoped directories prevent cross-user access at the filesystem level.
- The `uploads/` directory is `.gitignore`d and mounted as a Docker volume.

---

## 12. Environment Variables

```env
# App database
DATABASE_URL=postgresql://datavault:datavault@localhost:5432/datavault

# Encryption key for DB connection passwords (32 bytes hex = 64 chars)
ENCRYPTION_KEY=a1b2c3d4e5f6...

# File storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=100

# Auth
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# OpenAI — powers text-to-SQL, schema docs, semantic search, interface enhancement
OPENAI_API_KEY=sk-...
# Model selection (default: gpt-4o-mini for cost efficiency)
OPENAI_MODEL=gpt-4o-mini
```

---

## 13. Testing Strategy

| Layer | Tool | What to Test |
|-------|------|-------------|
| API routes | Jest + supertest (or Next.js test helpers) | CRUD operations, auth enforcement, error cases, edge cases (move to self, circular references) |
| Schema extractor | Jest with a test PostgreSQL database | Extraction accuracy against a known schema, enum parsing, FK detection |
| Frontend components | React Testing Library | Drag-and-drop interactions, file upload flow, search input debouncing |
| E2E | Playwright (optional) | Full flows: upload file → navigate to folder → drag to new folder → search → find it |
| Stress | Custom script | Seed 1000 files, measure list query time. Seed 10-level nested folders, measure tree query time. Upload 100MB file, measure completion time. |

---

## 14. Open Questions / Decisions to Make During Implementation

1. **Auth or no auth?** — If the assessors don't mention auth, skip it and hardcode a user ID. If they do, NextAuth credential flow takes ~1 hour to set up.

2. **Grid view vs. list view?** — Start with grid (more visual), add list view toggle as polish.

3. **Text-to-SQL: pattern matching or LLM?** — **Decided: LLM-first with pattern-matching fallback.** OpenAI key is available. GPT-4o-mini is the primary engine; pattern matching activates only if key is missing or API call fails.

4. **File versioning?** — Not in the prompt. Skip unless there's extra time.

5. **Real-time updates (WebSocket)?** — Not needed for a single-user take-home. Server action revalidation is sufficient.

6. **Relationship graph visualization** — Could use a simple canvas/SVG rendering with force-directed layout, or a simpler table-based visualization showing FK connections. Canvas approach is more impressive but takes longer.

---

## 15. OpenAI Integration — AI-Enhanced Features

With an OpenAI API key, five features get significant upgrades. All use `gpt-4o-mini` for cost efficiency. The architecture wraps OpenAI behind a `lib/ai/` module so every feature has a non-AI fallback when the key isn't configured.

### 15.1 Architecture

```
src/lib/ai/
├── client.ts              # OpenAI client singleton + key check
├── text-to-sql.ts         # Schema-aware SQL generation
├── schema-docs.ts         # Auto-document tables/columns
├── semantic-search.ts     # Natural language → search params
├── interface-enhance.ts   # Richer TypeScript interface generation
└── file-assist.ts         # Smart folder suggestions for uploads
```

```typescript
// lib/ai/client.ts
import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export function isAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
```

Every AI-powered function follows this pattern:
```typescript
export async function doSomethingWithAI(input: X): Promise<Y> {
  const ai = getAIClient();
  if (!ai) return fallback(input); // graceful degradation

  try {
    const result = await ai.chat.completions.create({ ... });
    return parse(result);
  } catch (err) {
    console.error('AI call failed, falling back:', err);
    return fallback(input);
  }
}
```

### 15.2 Text-to-SQL (Primary AI Feature)

**Without AI:** Pattern matching — fragile, only handles simple queries like "count users" or "show orders where total > 100."

**With AI:** GPT-4o-mini receives the full schema context and generates accurate SQL for complex queries:
- "Show me users who placed more than 5 orders in the last 30 days"
- "What's the average order value by product category?"
- "Find customers who haven't ordered since January"
- "Which products have never been ordered?"

**Prompt engineering:**

```typescript
// lib/ai/text-to-sql.ts
const SYSTEM_PROMPT = `You are a PostgreSQL SQL generator. Given a database schema and a natural language question, output ONLY a single valid PostgreSQL SELECT query.

Rules:
- ONLY SELECT statements. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE.
- Use proper JOINs based on the foreign key relationships provided.
- Use table aliases (e.g., u for users, o for orders) for readability.
- Include ORDER BY when the question implies ranking or sorting.
- Include LIMIT when the question asks for "top N" or a bounded result.
- Use aggregate functions (COUNT, SUM, AVG, MIN, MAX) with GROUP BY when appropriate.
- Handle date/time comparisons using PostgreSQL functions (NOW(), INTERVAL, DATE_TRUNC).
- For enum columns, use the exact enum values provided in the schema.
- Return ONLY raw SQL. No markdown, no explanation, no code fences.`;

export async function generateSQL(
  schema: ExtractedSchema,
  question: string
): Promise<{ sql: string; explanation: string }> {
  const ai = getAIClient();
  if (!ai) return patternMatchFallback(schema, question);

  const schemaSummary = buildSchemaSummary(schema);

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Schema:\n${schemaSummary}\n\nQuestion: ${question}` }
    ],
    temperature: 0,          // deterministic output
    max_tokens: 500,
  });

  const sql = response.choices[0].message.content!.trim();
  validateSQLSafety(sql); // throws if mutation keywords detected

  // Second call for human-readable explanation
  const explainResponse = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Explain this SQL query in 1-2 plain English sentences.' },
      { role: 'user', content: sql }
    ],
    temperature: 0,
    max_tokens: 100,
  });

  return {
    sql,
    explanation: explainResponse.choices[0].message.content!.trim(),
  };
}
```

**Schema summary builder** (compresses the cached schema to minimize tokens):
```typescript
function buildSchemaSummary(schema: ExtractedSchema): string {
  let summary = 'Tables:\n';
  for (const table of schema.tables) {
    const cols = table.columns.map(c => {
      let desc = `${c.name} ${c.type}`;
      if (c.isPrimaryKey) desc += ' PK';
      if (c.isForeignKey && c.references) desc += ` FK→${c.references.table}.${c.references.column}`;
      if (!c.nullable) desc += ' NOT NULL';
      return desc;
    }).join(', ');
    summary += `- ${table.name} (${cols}) ~${table.rowCountEstimate} rows\n`;
  }

  if (schema.enums.length > 0) {
    summary += '\nEnums:\n';
    for (const e of schema.enums) {
      summary += `- ${e.name}: ${e.values.map(v => `'${v}'`).join(', ')}\n`;
    }
  }

  return summary;
}
```

**UI enhancement** — The query runner shows:
1. The natural language input
2. The generated SQL (editable — user can tweak before executing)
3. An AI-generated plain-English explanation of what the query does
4. Query results in a sortable table
5. A "Suggested queries" section — AI generates 3-5 interesting questions based on the schema

### 15.3 Schema Auto-Documentation

**Without AI:** Tables and columns show raw names only. Users must interpret `is_active`, `created_at`, `fk_org_id` on their own.

**With AI:** GPT-4o-mini generates human-readable descriptions for every table and column based on naming patterns, types, and relationships.

```typescript
// lib/ai/schema-docs.ts
export async function generateSchemaDocumentation(
  schema: ExtractedSchema
): Promise<SchemaDocumentation> {
  const ai = getAIClient();
  if (!ai) return emptyDocs(schema);

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a database documentation generator. Given a PostgreSQL schema, generate a concise description for each table and each column. Output valid JSON matching this format:
{
  "tables": {
    "table_name": {
      "description": "One sentence describing the table's purpose",
      "columns": {
        "column_name": "One sentence describing this column"
      }
    }
  }
}`
      },
      {
        role: 'user',
        content: buildSchemaSummary(schema)
      }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content!);
}
```

**Example output:**
```json
{
  "tables": {
    "users": {
      "description": "Stores registered user accounts and their profile information",
      "columns": {
        "id": "Unique identifier for the user (UUID)",
        "email": "User's email address, used for login",
        "is_active": "Whether the user account is currently active and able to log in",
        "created_at": "Timestamp when the user account was created"
      }
    },
    "orders": {
      "description": "Tracks customer purchase orders and their current status",
      "columns": {
        "user_id": "References the customer who placed this order",
        "total": "Total monetary value of the order including all items",
        "status": "Current fulfillment status of the order (pending → paid → shipped → delivered)"
      }
    }
  }
}
```

**Where it shows up in the UI:**
- Table detail view: description appears below the table name
- Column table: a "Description" column with AI-generated text
- Hover tooltips on the table list sidebar
- Included in the JSON export

**Caching:** Documentation is generated once per extraction and stored alongside `cached_schema` in a `cached_docs JSONB` column on `db_connections`. Re-generated only when schema is re-extracted.

### 15.4 Semantic Search

**Without AI:** PostgreSQL full-text search matches keywords. Searching "budget spreadsheet" finds files named "budget" or "spreadsheet" but not "Q4 Financial Plan.xlsx".

**With AI:** GPT-4o-mini interprets the user's intent and extracts structured search parameters.

```typescript
// lib/ai/semantic-search.ts
interface SearchIntent {
  keywords: string[];         // words to match in file/folder names
  fileTypes?: string[];       // inferred MIME type filters (e.g., ["spreadsheet", "xlsx"])
  dateRange?: {               // "from last week" → { after: "2026-02-11" }
    after?: string;
    before?: string;
  };
  sizeRange?: {               // "large files" → { min: 10485760 }
    min?: number;
    max?: number;
  };
  context?: string;           // any additional context for ranking
}

export async function parseSearchIntent(query: string): Promise<SearchIntent> {
  const ai = getAIClient();
  if (!ai) return { keywords: query.split(/\s+/) };  // fallback: split on spaces

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You parse natural language file search queries into structured parameters. Output valid JSON matching this schema:
{
  "keywords": ["word1", "word2"],
  "fileTypes": ["pdf", "image"] | null,
  "dateRange": { "after": "YYYY-MM-DD", "before": "YYYY-MM-DD" } | null,
  "sizeRange": { "min": bytes, "max": bytes } | null,
  "context": "additional context" | null
}
Today's date is ${new Date().toISOString().split('T')[0]}.
File type mappings: "spreadsheet"→xlsx/csv, "document"→pdf/docx, "image"→png/jpg/gif, "video"→mp4/mov, "code"→js/ts/py`
      },
      { role: 'user', content: query }
    ],
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content!);
}
```

**Example transformations:**

| User types | Parsed intent | SQL effect |
|-----------|---------------|------------|
| "budget spreadsheet from last week" | `{ keywords: ["budget"], fileTypes: ["xlsx","csv"], dateRange: { after: "2026-02-11" } }` | `WHERE name ILIKE '%budget%' AND mime_type IN (...) AND created_at > '2026-02-11'` |
| "large PDF files" | `{ keywords: [], fileTypes: ["pdf"], sizeRange: { min: 10485760 } }` | `WHERE mime_type = 'application/pdf' AND size > 10485760` |
| "photos from the client meeting" | `{ keywords: ["client", "meeting"], fileTypes: ["png","jpg","gif"] }` | `WHERE name ILIKE ANY(...) AND mime_type IN (...)` |

**Hybrid approach:** AI-parsed intent generates additional SQL filters that are ANDed with the existing `tsvector` full-text search. This means the GIN index still does the heavy lifting, and AI just narrows the results.

### 15.5 Enhanced Interface Generation

**Without AI:** Mechanical type mapping — `varchar` → `string`, `int4` → `number`. Property names are raw column names (`created_at`, `user_id`). No JSDoc.

**With AI:** GPT-4o-mini generates richer interfaces with:
- JSDoc comments explaining each property's business meaning
- Smarter optional/required inference (e.g., `deleted_at` is likely optional even if nullable)
- Cleaner property names suggested (while keeping originals as comments)
- Utility types where appropriate (`Pick<User, 'id' | 'email'>` for common use cases)

```typescript
// lib/ai/interface-enhance.ts
export async function enhanceInterfaces(
  schema: ExtractedSchema,
  baseInterfaces: InferredInterface[]
): Promise<EnhancedInterface[]> {
  const ai = getAIClient();
  if (!ai) return baseInterfaces.map(i => ({ ...i, jsdoc: null, utilityTypes: [] }));

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You enhance TypeScript interfaces generated from a PostgreSQL database schema. For each interface:
1. Add a JSDoc comment explaining the entity's purpose
2. Add JSDoc comments to noteworthy properties (FKs, enums, non-obvious fields)
3. Suggest 1-2 utility types that would be commonly used in application code (e.g., CreateUserInput = Omit<User, 'id' | 'created_at'>)
Output valid JSON array.`
      },
      {
        role: 'user',
        content: JSON.stringify(baseInterfaces)
      }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content!);
}
```

**Example output:**
```typescript
/**
 * Represents a registered user account in the system.
 * Users can place orders and manage their profile information.
 */
interface User {
  /** Unique identifier (UUID v4) */
  id: string;
  /** User's email address — used as login credential, must be unique */
  email: string;
  /** Display name shown in the UI */
  name: string;
  /** Whether the account can currently log in */
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // Relations
  orders: Order[];
}

// Suggested utility types:
type CreateUserInput = Omit<User, 'id' | 'created_at' | 'updated_at' | 'orders'>;
type UserSummary = Pick<User, 'id' | 'email' | 'name'>;
```

### 15.6 Smart File Organization (Suggestion Only)

When uploading a file, AI suggests which folder to place it in based on:
- The file name and type
- The existing folder structure

```typescript
// lib/ai/file-assist.ts
export async function suggestFolder(
  fileName: string,
  mimeType: string,
  folderTree: TreeNode[]
): Promise<{ folderId: string; folderPath: string; reason: string } | null> {
  const ai = getAIClient();
  if (!ai) return null;

  const treeStr = folderTree.map(f =>
    `${'  '.repeat(f.depth)}${f.name} (id: ${f.id})`
  ).join('\n');

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Given a file being uploaded and the user's folder structure, suggest the best folder to place it in. If no folder is a good fit, respond with null. Output JSON: { "folderId": "...", "folderPath": "path/to/folder", "reason": "brief reason" } or null.`
      },
      {
        role: 'user',
        content: `File: "${fileName}" (${mimeType})\n\nFolder structure:\n${treeStr}`
      }
    ],
    temperature: 0,
    max_tokens: 100,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content!);
}
```

**UX:** Shows as a non-intrusive suggestion chip in the upload dialog: *"Suggested folder: Projects/Backend — [Use] [Dismiss]"*. Never auto-moves. User always chooses.

### 15.7 Suggested Queries for Schema Explorer

When a user opens the schema viewer, AI generates 3-5 interesting queries they might want to run based on the schema structure.

```typescript
// lib/ai/text-to-sql.ts
export async function suggestQueries(schema: ExtractedSchema): Promise<string[]> {
  const ai = getAIClient();
  if (!ai) return [];

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Given a database schema, suggest 5 interesting analytical questions a developer might ask. Return a JSON array of question strings. Focus on questions that use JOINs, aggregations, and date filtering.'
      },
      { role: 'user', content: buildSchemaSummary(schema) }
    ],
    temperature: 0.7,        // some creativity here is fine
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content!).questions;
}
```

**Example suggestions for an e-commerce schema:**
- "What are the top 10 best-selling products by revenue?"
- "Which customers haven't placed an order in the last 90 days?"
- "What's the average order value broken down by month?"
- "Which product categories have the highest return rate?"
- "Show me users who signed up but never completed a purchase"

These appear as clickable chips above the query input — clicking one populates the input and auto-runs.

### 15.8 AI Cost & Performance Summary

| Feature | Model | Tokens/call | Cost/call | Latency | Cached? |
|---------|-------|-------------|-----------|---------|---------|
| Text-to-SQL | gpt-4o-mini | ~2K in, ~200 out | ~$0.0004 | ~1s | No (each query is unique) |
| SQL Explanation | gpt-4o-mini | ~300 in, ~50 out | ~$0.0001 | ~0.5s | No |
| Schema Docs | gpt-4o-mini | ~3K in, ~1.5K out | ~$0.001 | ~2s | Yes (in DB alongside cached_schema) |
| Semantic Search | gpt-4o-mini | ~200 in, ~100 out | ~$0.0001 | ~0.5s | No |
| Interface Enhance | gpt-4o-mini | ~2K in, ~1K out | ~$0.001 | ~1.5s | Yes (part of extraction) |
| Folder Suggestion | gpt-4o-mini | ~500 in, ~50 out | ~$0.0001 | ~0.5s | No |
| Suggested Queries | gpt-4o-mini | ~2K in, ~200 out | ~$0.0004 | ~1s | Yes (per extraction) |

**Total cost for a full demo session** (extract schema, browse, run 20 queries, upload 10 files, search 10 times): ~$0.02

### 15.9 Database Changes for AI Features

One new column on `db_connections`:

```sql
ALTER TABLE db_connections ADD COLUMN cached_docs JSONB;
```

This stores the AI-generated documentation alongside the cached schema. Updated whenever schema is re-extracted.

### 15.10 Updated Project Structure

```
src/lib/ai/
├── client.ts              # OpenAI client singleton
├── text-to-sql.ts         # generateSQL(), suggestQueries()
├── schema-docs.ts         # generateSchemaDocumentation()
├── semantic-search.ts     # parseSearchIntent()
├── interface-enhance.ts   # enhanceInterfaces()
└── file-assist.ts         # suggestFolder()
```

### 15.11 Feature Flags in UI

The frontend detects whether AI is enabled via a simple API call:

```typescript
// GET /api/ai/status → { enabled: boolean }
```

When AI is disabled:
- Text-to-SQL shows a simpler input with pattern-matching caveat
- Schema viewer omits the "Description" column
- Search bar works as keyword-only (no intent parsing)
- Upload dialog omits folder suggestion
- No "Suggested queries" chips

When AI is enabled:
- All features light up with an unobtrusive "AI" badge
- Slightly longer loading states (show skeleton + "Generating..." text)
