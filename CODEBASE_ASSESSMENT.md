# Codebase Quality Assessment: DataVault

## Executive Summary

DataVault is a Next.js 16 application providing a hosted file system and database schema explorer. The codebase demonstrates solid foundational architecture with clear separation between API routes, shared libraries, and UI components. The project follows many best practices but has measurable opportunities for improvement in code reuse, type safety, scalability, and structural organization.

**Overall Rating: B+** -- Well-structured for a take-home project with thoughtful architecture decisions, but with concrete areas where refactoring would improve maintainability at scale.

---

## 1. Architecture & Organization

### Strengths

- **Clean Next.js App Router usage**: Route groups (`(dashboard)`), dynamic route segments, and layout nesting are correctly applied.
- **Dedicated `lib/` layer**: Database access (`db.ts`), file storage (`storage.ts`), encryption (`encryption.ts`), constants (`constants.ts`), and API response helpers (`api-response.ts`) are properly extracted from route handlers.
- **Schema extractor modularization**: The `schema-extractor/` directory breaks a complex feature into focused modules (`tables.ts`, `relationships.ts`, `enums.ts`, `indexes.ts`, `interfaces.ts`) with a clean barrel export via `index.ts` and shared `types.ts`.
- **Component colocation**: Schema-specific components live in `components/schema/`, UI primitives in `components/ui/`, layout concerns in `components/layout/`.
- **Prisma singleton pattern** in `db.ts` correctly avoids connection exhaustion during development hot reloads.

### Issues

**I-1: No shared type definitions for API contracts**

Interface types like `FileItem`, `FolderItem`, `GridItem`, `CtxMenu`, `SearchResults`, `DbConnection`, and `SchemaTable` are redefined independently in each page/component file that uses them. There is no shared `types/` directory or barrel file. This causes:
- 7+ duplicate definitions of `FileItem` across `files/page.tsx`, `files/[folderId]/page.tsx`, and `search/page.tsx`
- `formatSize()` duplicated in `files/page.tsx`, `files/[folderId]/page.tsx`, and `UploadDialog.tsx`
- `FolderIcon` and `FileIcon` duplicated identically across both files pages

*Recommendation*: Create `src/types/` with shared API response types and move utility functions and icon components to shared modules.

**I-2: No dedicated data-fetching/service layer**

Every page and the Sidebar directly call `fetch("/api/...")` inline. There is no abstraction for API calls, meaning:
- Error handling for fetch failures is inconsistent (some use `.catch(() => {})`, some don't handle errors at all)
- API endpoint URLs are scattered as string literals across 10+ files
- No centralized response typing or error handling

*Recommendation*: Create `src/lib/api-client.ts` with typed functions like `getFiles(folderId?)`, `createFolder(name, parentId?)`, etc.

---

## 2. Code Reusability

### Strengths

- **`usePaginatedFilter` hook**: Well-designed custom hook that encapsulates search, filtering, and pagination logic. Used consistently across all 5 schema tab components.
- **`useDialog` hooks**: `useConfirmDialog` and `usePromptDialog` in `useDialog.ts` use a clever Promise-based pattern to make dialog interactions feel imperative while keeping React state management correct.
- **`Modal` component**: Shared base component reused by `ConfirmDialog`, `PromptDialog`, `UploadDialog`, and `AddConnectionDialog`.
- **`successResponse`/`errorResponse` helpers**: Consistent API response shape across all routes.

### Issues

**I-3: Massive code duplication between `files/page.tsx` and `files/[folderId]/page.tsx`**

These two files are ~555 and ~589 lines respectively and share approximately 80% identical logic:
- Identical drag-and-drop handlers (`handleDragStart`, `handleDragEnd`, `handleFolderDragOver`, `handleFolderDragLeave`, `handleFolderDrop`)
- Identical external drop handlers (`handlePageDragOver`, `handlePageDragEnter`, `handlePageDragLeave`, `handlePageDrop`)
- Identical `renderGridView()` and `renderListView()` functions
- Identical context menu construction
- Identical `handleDeleteFile`, `handleRenameFile`, `handleDeleteFolder`, `handleRenameFolder` functions
- Identical sorting/pagination logic
- Identical `FolderIcon` and `FileIcon` components

*Recommendation*: Extract shared file browser logic into a `useFileBrowser` hook and shared rendering components (`FileGrid`, `FileList`, `FileItem`, `FolderItem`). The two pages should differ only in their data source and breadcrumb rendering.

**I-4: Drag-and-drop logic duplicated across Sidebar, files/page.tsx, and files/[folderId]/page.tsx**

The `handleSidebarDrop` in `Sidebar.tsx` (lines 279-317) contains the same PATCH-based move logic as `handleFolderDrop` in both file pages. The toast messages, error handling, and API calls are copy-pasted.

*Recommendation*: Extract `moveItem(type, id, targetFolderId)` into a shared utility/hook.

**I-5: `formatSize()` defined 3 times**

The exact same byte-formatting function appears in:
- `src/app/(dashboard)/files/page.tsx` (line 39)
- `src/app/(dashboard)/files/[folderId]/page.tsx` (line 53)
- `src/components/ui/UploadDialog.tsx` (line 13)

*Recommendation*: Move to `src/lib/format.ts`.

---

## 3. Readability & Code Quality

### Strengths

- **Consistent coding style**: The codebase maintains consistent naming conventions (camelCase for variables/functions, PascalCase for components/types), consistent import ordering, and consistent use of TypeScript.
- **TypeScript strict mode enabled**: `tsconfig.json` has `"strict": true`, which is best practice.
- **Minimal unnecessary comments**: The code is largely self-documenting. Comments appear only where they add value (e.g., explaining the recursive CTE for breadcrumbs, explaining the circular reference check).
- **Tailwind usage is consistent**: Dark mode support is implemented throughout using the `dark:` variant pattern.

### Issues

**I-6: Large component files with mixed concerns**

`Sidebar.tsx` is 571 lines and handles:
- Folder tree data fetching and rendering
- DB connection list rendering
- Global search with debounced API calls and dropdown results
- Context menu logic for both folders and connections
- Drag-and-drop handling with auto-expand timers
- Dialog management (confirm, prompt, add connection)

This violates the Single Responsibility Principle and makes the component difficult to maintain.

*Recommendation*: Extract into `SidebarSearch`, `FolderTree`, `ConnectionList` sub-components.

**I-7: Inline SVG icons throughout**

SVG icons are inlined directly into components (`FolderIcon`, `FileIcon`, `DbIcon`, collapse arrows, upload icons, spinner, etc.). Some are defined as components, others are raw JSX. This creates visual noise and inconsistency.

*Recommendation*: Create an `src/components/icons/` directory with reusable icon components, or adopt a lightweight icon library.

**I-8: Magic numbers**

- `PAGE_SIZE = 12` (file pages) vs `PAGE_SIZE = 20` (schema tabs) -- different defaults with no documentation as to why
- `300` ms debounce in sidebar search
- `800` ms auto-expand timer for drag-over
- `10000` ms connection timeout

*Recommendation*: Move configurable values to constants or accept them as parameters.

---

## 4. Scalability

### Strengths

- **Recursive CTEs for folder operations**: Breadcrumbs, circular reference detection, and descendant file deletion all use PostgreSQL recursive CTEs -- this scales correctly regardless of folder depth.
- **Parallel schema extraction**: `extractSchema` uses `Promise.all` to run table, relationship, enum, and index extraction concurrently.
- **Database indexing**: The Prisma schema includes composite indexes on `[userId, parentId]` for folders and `[userId, folderId]` for files -- correct for the query patterns used.
- **Dynamic import for SchemaDiagram**: ReactFlow is loaded with `next/dynamic` and `ssr: false` to avoid hydration issues and reduce initial bundle size.

### Issues

**I-9: Hardcoded single-user model**

`DEFAULT_USER_ID` is imported and used in every API route handler. While this is acknowledged as a simplification, the current architecture makes adding multi-user support a significant refactoring effort because:
- User identification is not handled via middleware or context
- Every route handler independently references `DEFAULT_USER_ID` in query filters
- There's no authentication or session layer

*Recommendation*: Introduce a `getUserId(request)` helper (or middleware) that returns the current user ID. Replace all `DEFAULT_USER_ID` references with calls to this function. This makes the eventual addition of authentication a single-point change.

**I-10: No pagination on API routes**

All list endpoints (`GET /api/files`, `GET /api/folders`, `GET /api/db-connections`, `GET /api/search`) fetch all matching records at once. Client-side pagination (`usePaginatedFilter`, `Pagination` component) only pages over already-fetched data. For large datasets, this will cause:
- Slow API responses
- High memory usage on both server and client
- Large JSON payloads over the wire

*Recommendation*: Add `limit`/`offset` (or cursor-based) pagination to API routes and push filtering server-side.

**I-11: File upload is fully buffered in memory**

In `POST /api/files`, the entire file is read into a `Buffer` via `file.arrayBuffer()` before writing to disk. For the configured 100MB max file size, this means a single upload can consume 100MB+ of server memory. Multiple concurrent uploads could crash the process.

*Recommendation*: Stream file data directly to disk using a streaming approach rather than buffering the entire file.

**I-12: Folder download buffers entire ZIP in memory**

In `GET /api/folders/[id]/download`, the ZIP archive is fully assembled in memory before being sent. For folders with many or large files, this is a scalability bottleneck.

*Recommendation*: Stream the ZIP response directly to the client using `ReadableStream` rather than collecting all chunks into a buffer.

---

## 5. Error Handling & Robustness

### Strengths

- **Consistent error response format**: All API routes use `errorResponse(code, message, status)` producing `{ error: { code, message, status } }`.
- **Specific error codes**: Uses meaningful codes like `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `CONNECTION_FAILED`, `PRECONDITION_FAILED`, `UNSAFE_SQL`, `AI_ERROR`, `QUERY_ERROR`.
- **Read-only transaction for AI queries**: The query route wraps AI-generated SQL in `BEGIN READ ONLY` / `COMMIT` / `ROLLBACK` to prevent data modification.
- **SQL safety validation**: `validateSQLSafety` regex-checks for mutating keywords before execution.
- **Circular reference prevention**: Folder move operations use a recursive CTE to detect cycles.

### Issues

**I-13: Inconsistent error toast variants**

In multiple places, error conditions use `"success"` as the toast variant instead of an error variant:

```typescript
// Sidebar.tsx line 238
toast.updateToast(toastId, "Schema refresh failed", "success");

// files/page.tsx lines 246, 256
toast.showToast("Failed to move file", "success");
toast.showToast("Failed to move folder", "success");
```

The toast system only supports `"success" | "loading"` variants -- there is no `"error"` variant.

*Recommendation*: Add an `"error"` variant to the toast system and use it for failure messages.

**I-14: Silent fetch failures on page load**

Several data-fetching calls silently swallow errors:

```typescript
// Sidebar.tsx lines 96-103
fetch("/api/folders/tree")
  .then((r) => r.json())
  .then((d) => setFolders(d.data || []))
  .catch(() => {});
```

Network errors, API failures, or malformed responses produce no user feedback.

*Recommendation*: Show error states or toast notifications when critical data fails to load.

**I-15: No input sanitization on raw SQL queries**

The search route constructs a `searchTerm` for `ILIKE` matching:
```typescript
const searchTerm = `%${q.trim()}%`;
```
While this is passed through Prisma's tagged template (preventing SQL injection), the `searchTerm` variable is constructed but the `contains` mode is used for files/folders instead. The `searchTerm` is only used in the raw query for `db_connections`, where it's properly parameterized. However, `%` and `_` characters in user input are not escaped, meaning they act as LIKE wildcards.

*Recommendation*: Escape `%` and `_` characters in user-provided search terms.

**I-16: Unused variable `searchTerm` in search route**

The `searchTerm` variable is constructed on line 15 of the search route but is only used for the raw query. The Prisma `findMany` calls use `q.trim()` directly. This is not a bug but is dead-ish code that could confuse readers.

---

## 6. Security

### Strengths

- **AES-256-GCM encryption for database passwords**: Properly uses authenticated encryption with random IVs. The encrypted format stores `iv:tag:ciphertext` so each encryption produces unique output.
- **Sensitive data exclusion**: The `GET /api/db-connections` list endpoint explicitly excludes `encryptedPassword` and `cachedSchema` from the select.
- **Read-only query execution**: AI-generated queries run inside read-only transactions.

### Issues

**I-17: `ENCRYPTION_KEY` validation only at runtime**

The encryption key is validated (length check) only when `encrypt()`/`decrypt()` is first called. If the key is missing or malformed, the error surfaces during a user action rather than at startup.

*Recommendation*: Validate `ENCRYPTION_KEY` during app startup (e.g., in `instrumentation.ts` or a startup check).

**I-18: No rate limiting on AI query endpoint**

The `POST /api/db-connections/[id]/query` endpoint calls the OpenAI API with no rate limiting. A malicious or overzealous client could generate significant API costs.

**I-19: SQL safety validation is regex-based**

The `UNSAFE_PATTERN` regex is a blocklist approach. A sophisticated prompt injection could potentially generate SQL using CTEs, `COPY`, `DO` blocks, or function calls that bypass keyword matching while still being destructive.

*Recommendation*: Consider using PostgreSQL's `EXPLAIN` to validate query plans, or restrict the database user's permissions to read-only at the PostgreSQL role level (defense-in-depth).

---

## 7. Testing

### Strengths

- **Good coverage of API routes**: Tests cover happy paths, validation failures, 404s, and edge cases (circular folder references, empty names, missing files).
- **Well-organized test helpers**: `createMockPrisma()`, `createMockRequest()`, `createMockPool()`, and sample fixtures reduce boilerplate.
- **Schema extractor unit tests**: Each extractor module is tested independently with mocked `pg.Pool`.
- **AI safety tests**: `text-to-sql.test.ts` thoroughly tests the SQL safety validator including case-insensitivity and subqueries.
- **Interface inference tests**: Tests verify PG-to-TS type mapping, enum handling, FK relations, reverse relations, and optionality logic.

### Issues

**I-20: No tests for several API routes**

The following routes have no test coverage:
- `GET /api/files/[id]/preview`
- `GET /api/folders/tree`
- `GET /api/folders/[id]/download`
- `POST /api/db-connections` and related routes
- `POST /api/db-connections/[id]/extract`
- `POST /api/db-connections/[id]/query`
- `GET /api/ai/status`

**I-21: No frontend/component tests**

There are zero tests for React components. Given the complexity of drag-and-drop, context menus, and dialog flows, component tests would catch regressions in user interactions.

**I-22: Test helpers use `any` type**

`createMockRequest` uses `any` for the body parameter and the return value is cast with `as any` at call sites. This undermines TypeScript's value in test code.

---

## 8. Specific Optimization Opportunities

### O-1: Consolidate file browser pages

Extract common file browser logic into reusable hooks and components:

```
src/
  hooks/
    useFileBrowser.ts      -- data loading, sorting, pagination, drag-drop
    useItemActions.ts      -- delete, rename, move operations
  components/
    files/
      FileGrid.tsx         -- grid view rendering
      FileList.tsx          -- list view rendering  
      FileItemCard.tsx      -- individual file card
      FolderItemCard.tsx    -- individual folder card
      FileBrowserToolbar.tsx -- sort, view toggle, action buttons
      DropZone.tsx          -- external file drop overlay
```

This would reduce `files/page.tsx` and `files/[folderId]/page.tsx` from ~570 lines each to ~60-80 lines each.

### O-2: Extract API client layer

```typescript
// src/lib/api-client.ts
export async function apiGet<T>(path: string): Promise<T> { ... }
export async function apiPost<T>(path: string, body: unknown): Promise<T> { ... }
export const filesApi = {
  list: (folderId?: string) => apiGet<FileItem[]>(`/api/files?folderId=${folderId}`),
  upload: (file: File, folderId?: string) => { ... },
  rename: (id: string, name: string) => apiPost(`/api/files/${id}`, { name }),
  delete: (id: string) => apiDelete(`/api/files/${id}`),
  move: (id: string, folderId: string | null) => apiPost(`/api/files/${id}`, { folderId }),
};
```

### O-3: Unify Pagination components

There are two nearly identical `Pagination` components:
- `src/components/ui/Pagination.tsx` (used in file pages)
- `src/components/schema/Pagination.tsx` (used in schema tabs)

They differ only in margin/padding classes. Consolidate into a single component with style variants.

### O-4: Add an error toast variant

Extend the `Toast` interface to support `"error"` variant:

```typescript
interface Toast {
  id: number;
  message: string;
  variant: "success" | "loading" | "error";
}
```

### O-5: Pool management for external DB connections

In the query route, a new `Pool` is created for every request and immediately ended. For repeated queries against the same database, this is inefficient.

*Recommendation*: Consider caching pools by connection ID with a TTL, or use a single-connection approach for one-off queries.

---

## 9. Summary of Findings

| Category | Grade | Key Strengths | Top Issues |
|----------|-------|---------------|------------|
| Architecture | A- | Clean module boundaries, proper Next.js patterns | No shared types, no API client layer |
| Reusability | B- | Good hooks (`usePaginatedFilter`, `useDialog`) | ~80% duplication between file pages |
| Readability | B+ | Consistent style, self-documenting code | 571-line Sidebar, inline SVGs |
| Scalability | B | Recursive CTEs, parallel extraction, proper indexes | No server-side pagination, in-memory file buffering |
| Error Handling | B | Consistent error codes, safety validation | Error toasts show as "success", silent fetch failures |
| Security | B+ | AES-256-GCM, read-only transactions, data exclusion | Regex-only SQL validation, no rate limiting |
| Testing | B | Good API route coverage, thorough schema tests | No component tests, several untested routes |

### Priority Recommendations (by impact-to-effort ratio)

1. **Extract shared file browser components/hooks** -- Eliminates ~500 lines of duplication, improves maintainability
2. **Create API client layer** -- Centralizes fetch logic, enables consistent error handling
3. **Add error toast variant** -- Bug fix (errors currently show as success)
4. **Consolidate shared types** -- Eliminates 7+ duplicate interfaces
5. **Move `formatSize` and icons to shared modules** -- Quick wins for code reuse
6. **Add server-side pagination** -- Critical for production scalability
7. **Stream file uploads/downloads** -- Prevents OOM with large files
8. **Extract Sidebar into sub-components** -- Improves readability and testability
