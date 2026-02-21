"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRefresh } from "./RefreshContext";
import { useDrag } from "./DragContext";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import AddConnectionDialog from "@/components/ui/AddConnectionDialog";
import { useConfirmDialog, usePromptDialog } from "@/components/ui/useDialog";
import { useToast } from "./ToastContext";
import { moveItem } from "@/lib/move-item";

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
}

interface TreeNode extends FolderNode {
  children: TreeNode[];
}

interface DbConnection {
  id: string;
  name: string;
}

interface CtxMenu {
  x: number;
  y: number;
  type: "folder" | "connection";
  id: string;
  name: string;
}

interface SearchResults {
  files: { id: string; name: string; mimeType: string; size: number; type: "file" }[];
  folders: { id: string; name: string; parentId: string | null; type: "folder" }[];
  dbConnections: { id: string; name: string; type: "db_connection" }[];
}

function buildTree(folders: FolderNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortChildren(n.children);
  }
  sortChildren(roots);

  return roots;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { refreshKey, triggerRefresh } = useRefresh();
  const { dragging, setDragging } = useDrag();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const autoExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirmDialog = useConfirmDialog();
  const promptDialog = usePromptDialog();
  const toast = useToast();

  const tree = useMemo(() => buildTree(folders), [folders]);

  useEffect(() => {
    fetch("/api/folders/tree")
      .then((r) => r.json())
      .then((d) => setFolders(d.data || []))
      .catch(() => {});
    fetch("/api/db-connections")
      .then((r) => r.json())
      .then((d) => setConnections(d.data || []))
      .catch(() => {});
  }, [refreshKey]);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setSearchResults(data.data || null);
      } catch {
        setSearchResults(null);
      }
      setSearching(false);
    }, 300);
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
    setSearching(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        if (searchResults) setSearchResults(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchResults]);

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      const ok = await confirmDialog.confirm({
        title: "Delete Folder",
        message: "Delete this folder and all its contents? This cannot be undone.",
        confirmLabel: "Delete",
        variant: "danger",
      });
      if (!ok) return;
      await fetch(`/api/folders/${id}`, { method: "DELETE" });
      triggerRefresh();
      if (pathname === `/files/${id}`) {
        const folder = folders.find((f) => f.id === id);
        router.push(folder?.parentId ? `/files/${folder.parentId}` : "/files");
      }
    },
    [confirmDialog, triggerRefresh, pathname, folders, router]
  );

  const handleRenameFolder = useCallback(
    async (id: string, currentName: string) => {
      const name = await promptDialog.prompt({
        title: "Rename Folder",
        defaultValue: currentName,
      });
      if (!name || name === currentName) return;
      await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      triggerRefresh();
    },
    [promptDialog, triggerRefresh]
  );

  const handleCreateFolder = useCallback(
    async (parentId?: string) => {
      const name = await promptDialog.prompt({
        title: "New Folder",
        placeholder: "Folder name",
      });
      if (!name) return;
      await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      });
      triggerRefresh();
    },
    [promptDialog, triggerRefresh]
  );

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleFolderContextMenu(e: React.MouseEvent, folder: FolderNode) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "folder", id: folder.id, name: folder.name });
  }

  function handleConnectionContextMenu(e: React.MouseEvent, conn: DbConnection) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "connection", id: conn.id, name: conn.name });
  }

  async function handleDeleteConnection(id: string) {
    const ok = await confirmDialog.confirm({
      title: "Delete Connection",
      message: "Delete this connection and its extracted schema? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/db-connections/${id}`, { method: "DELETE" });
    triggerRefresh();
    if (pathname.startsWith(`/db/${id}`)) {
      router.push("/files");
    }
  }

  async function handleRefreshConnection(id: string) {
    const toastId = toast.showToast("Refreshing schema...", "loading");
    const res = await fetch(`/api/db-connections/${id}/extract`, { method: "POST" });
    triggerRefresh();
    if (res.ok) {
      toast.updateToast(toastId, "Schema refreshed successfully", "success");
    } else {
      toast.updateToast(toastId, "Schema refresh failed", "success");
    }
  }

  // --- Sidebar drop handlers ---
  function handleSidebarDragOver(e: React.DragEvent, targetId: string | null) {
    if (e.dataTransfer.types.includes("application/x-datavault")) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDropTargetId(targetId);
    }
  }

  function handleSidebarDragEnter(e: React.DragEvent, targetId: string | null) {
    if (e.dataTransfer.types.includes("application/x-datavault")) {
      e.preventDefault();
      e.stopPropagation();
      setDropTargetId(targetId);
      if (targetId && collapsed.has(targetId)) {
        if (autoExpandTimer.current) clearTimeout(autoExpandTimer.current);
        autoExpandTimer.current = setTimeout(() => {
          setCollapsed((prev) => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });
        }, 800);
      }
    }
  }

  function handleSidebarDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    if (autoExpandTimer.current) {
      clearTimeout(autoExpandTimer.current);
      autoExpandTimer.current = null;
    }
  }

  async function handleSidebarDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    if (autoExpandTimer.current) {
      clearTimeout(autoExpandTimer.current);
      autoExpandTimer.current = null;
    }
    const raw = e.dataTransfer.getData("application/x-datavault");
    if (!raw) return;
    const item = JSON.parse(raw) as { type: string; id: string; name: string };
    if (item.id === targetFolderId) return;

    const result = await moveItem(item.type, item.id, targetFolderId);
    if (result.ok) {
      toast.showToast(`Moved "${item.name}"${targetFolderId ? " to folder" : " to root"}`, "success");
    } else {
      toast.showToast(`Failed to move ${item.type}`, "success");
    }
    setDragging(null);
    triggerRefresh();
  }

  const ctxItems: ContextMenuItem[] = ctxMenu
    ? ctxMenu.type === "folder"
      ? [
          { label: "New Folder", onClick: () => handleCreateFolder(ctxMenu.id) },
          { label: "Download", onClick: () => { window.location.href = `/api/folders/${ctxMenu.id}/download`; } },
          { label: "Rename", onClick: () => handleRenameFolder(ctxMenu.id, ctxMenu.name) },
          { label: "Delete", onClick: () => handleDeleteFolder(ctxMenu.id), variant: "danger" },
        ]
      : [
          { label: "Refresh Schema", onClick: () => handleRefreshConnection(ctxMenu.id) },
          { label: "Delete", onClick: () => handleDeleteConnection(ctxMenu.id), variant: "danger" },
        ]
    : [];

  function renderFolder(node: TreeNode) {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.id);
    const indent = (node.depth + 1) * 16 + 12;
    const isDropTarget = dropTargetId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center transition-colors rounded ${
            isDropTarget ? "bg-blue-100 dark:bg-blue-900/30" : ""
          }`}
          onDragOver={(e) => handleSidebarDragOver(e, node.id)}
          onDragEnter={(e) => handleSidebarDragEnter(e, node.id)}
          onDragLeave={handleSidebarDragLeave}
          onDrop={(e) => handleSidebarDrop(e, node.id)}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleCollapse(node.id)}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              style={{ marginLeft: `${indent - 16}px` }}
            >
              <svg
                className={`w-3 h-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6 4l8 6-8 6V4z" />
              </svg>
            </button>
          ) : (
            <span style={{ marginLeft: `${indent}px` }} />
          )}
          <Link
            href={`/files/${node.id}`}
            onContextMenu={(e) => handleFolderContextMenu(e, node)}
            className={`flex-1 block px-2 py-1.5 rounded text-sm truncate ${
              pathname === `/files/${node.id}`
                ? "bg-zinc-200 dark:bg-zinc-800 font-medium"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            {node.name}
          </Link>
        </div>
        {hasChildren && !isCollapsed && node.children.map((child) => renderFolder(child))}
      </div>
    );
  }

  return (
    <aside className="w-64 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/files" className="text-lg font-bold">
          DataVault
        </Link>
      </div>

      <div ref={searchRef} className="p-3 border-t border-zinc-200 dark:border-zinc-800 relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs"
            >
              &times;
            </button>
          )}
        </div>
        {(searching || searchResults) && (
          <div className="absolute left-3 right-3 top-full mt-1 z-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {searching && !searchResults && (
              <p className="px-3 py-2 text-xs text-zinc-500">Searching...</p>
            )}
            {searchResults && (
              <>
                {searchResults.folders.length === 0 &&
                  searchResults.files.length === 0 &&
                  searchResults.dbConnections.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-500">No results found.</p>
                  )}
                {searchResults.folders.map((f) => (
                  <Link
                    key={f.id}
                    href={`/files/${f.id}`}
                    onClick={clearSearch}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="text-zinc-400 text-xs">folder</span>
                    <span className="truncate">{f.name}</span>
                  </Link>
                ))}
                {searchResults.files.map((f) => (
                  <Link
                    key={f.id}
                    href={f.mimeType ? `/api/files/${f.id}/preview` : `/api/files/${f.id}`}
                    onClick={clearSearch}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="text-zinc-400 text-xs">file</span>
                    <span className="truncate">{f.name}</span>
                  </Link>
                ))}
                {searchResults.dbConnections.map((c) => (
                  <Link
                    key={c.id}
                    href={`/db/${c.id}`}
                    onClick={clearSearch}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="text-zinc-400 text-xs">db</span>
                    <span className="truncate">{c.name}</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        <Link
          href="/files"
          onDragOver={(e) => handleSidebarDragOver(e, null)}
          onDragEnter={(e) => handleSidebarDragEnter(e, null)}
          onDragLeave={handleSidebarDragLeave}
          onDrop={(e) => handleSidebarDrop(e, null)}
          className={`block px-3 py-2 rounded text-sm transition-colors ${
            dropTargetId === null && dragging
              ? "bg-blue-100 dark:bg-blue-900/30"
              : pathname === "/files"
              ? "bg-zinc-200 dark:bg-zinc-800 font-medium"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          All Files
        </Link>

        {tree.map((node) => renderFolder(node))}

        <button
          onClick={() => toggleCollapse("__db_connections__")}
          className="flex items-center gap-1 pt-4 pb-1 px-3 w-full text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <svg
            className={`w-3 h-3 transition-transform ${collapsed.has("__db_connections__") ? "" : "rotate-90"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M6 4l8 6-8 6V4z" />
          </svg>
          DB Connections
        </button>

        {!collapsed.has("__db_connections__") && (
          <>
            <Link
              href="/db"
              className={`block px-3 py-1.5 rounded text-sm ${
                pathname === "/db"
                  ? "bg-zinc-200 dark:bg-zinc-800 font-medium"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              All Connections
            </Link>
            {connections.map((c) => (
              <Link
                key={c.id}
                href={`/db/${c.id}`}
                onContextMenu={(e) => handleConnectionContextMenu(e, c)}
                className={`block px-3 py-1.5 rounded text-sm truncate ${
                  pathname.startsWith(`/db/${c.id}`)
                    ? "bg-zinc-200 dark:bg-zinc-800 font-medium"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                {c.name}
              </Link>
            ))}

            <button
              onClick={() => setShowAddConnection(true)}
              className="block w-full text-left px-3 py-1.5 rounded text-sm text-blue-600 dark:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              + Add Connection
            </button>
          </>
        )}
      </nav>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxItems}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.state.open}
        title={confirmDialog.state.title}
        message={confirmDialog.state.message}
        confirmLabel={confirmDialog.state.confirmLabel}
        variant={confirmDialog.state.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
      <PromptDialog
        open={promptDialog.state.open}
        title={promptDialog.state.title}
        defaultValue={promptDialog.state.defaultValue}
        placeholder={promptDialog.state.placeholder}
        confirmLabel={promptDialog.state.confirmLabel}
        onConfirm={promptDialog.onConfirm}
        onCancel={promptDialog.onCancel}
      />
      <AddConnectionDialog
        open={showAddConnection}
        onClose={() => setShowAddConnection(false)}
        onCreated={(id) => {
          setShowAddConnection(false);
          triggerRefresh();
          router.push(`/db/${id}`);
        }}
      />
    </aside>
  );
}
