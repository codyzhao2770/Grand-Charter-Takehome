"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRefresh } from "@/components/layout/RefreshContext";
import { useToast } from "@/components/layout/ToastContext";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AddConnectionDialog from "@/components/ui/AddConnectionDialog";
import { useConfirmDialog } from "@/components/ui/useDialog";
import Pagination from "@/components/ui/Pagination";
import SortSelect, { type SortOption } from "@/components/ui/SortSelect";
import ViewToggle, { type ViewMode } from "@/components/ui/ViewToggle";

interface DbConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  lastExtractedAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 12;

export default function AllConnectionsPage() {
  const router = useRouter();
  const { refreshKey, triggerRefresh } = useRefresh();
  const toast = useToast();
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [view, setView] = useState<ViewMode>("grid");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);

  const confirmDialog = useConfirmDialog();

  const loadData = useCallback(() => {
    fetch("/api/db-connections")
      .then((r) => r.json())
      .then((d) => setConnections(d.data || []));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const sortedConnections = useMemo(() => {
    const sorted = [...connections];
    sorted.sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "recent":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });
    return sorted;
  }, [connections, sort]);

  async function handleDelete(id: string) {
    const ok = await confirmDialog.confirm({
      title: "Delete Connection",
      message: "Delete this connection and its extracted schema? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/db-connections/${id}`, { method: "DELETE" });
    triggerRefresh();
    loadData();
  }

  async function handleRefresh(id: string) {
    const toastId = toast.showToast("Refreshing schema...", "loading");
    const res = await fetch(`/api/db-connections/${id}/extract`, { method: "POST" });
    loadData();
    if (res.ok) {
      toast.updateToast(toastId, "Schema refreshed successfully", "success");
    } else {
      toast.updateToast(toastId, "Schema refresh failed", "error");
    }
  }

  function handleContextMenu(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, id, name });
  }

  const totalPages = Math.ceil(sortedConnections.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = sortedConnections.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const ctxItems: ContextMenuItem[] = ctxMenu
    ? [
        { label: "Open", onClick: () => router.push(`/db/${ctxMenu.id}`) },
        { label: "Refresh Schema", onClick: () => handleRefresh(ctxMenu.id) },
        { label: "Delete", onClick: () => handleDelete(ctxMenu.id), variant: "danger" },
      ]
    : [];

  function DbIcon({ className }: { className?: string }) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75m16.5 3.75v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
      </svg>
    );
  }

  function renderGridView() {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {paged.map((c) => (
          <div
            key={c.id}
            onContextMenu={(e) => handleContextMenu(e, c.id, c.name)}
            className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group flex flex-col items-center justify-center text-center aspect-square"
          >
            <DbIcon className="w-10 h-10 mb-3 text-emerald-500" />
            <Link href={`/db/${c.id}`} className="block font-medium truncate w-full px-1">
              {c.name}
            </Link>
            <p className="text-xs text-zinc-500 mt-1">
              {c.host}:{c.port}/{c.databaseName}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {c.lastExtractedAt
                ? `Extracted: ${new Date(c.lastExtractedAt).toLocaleDateString()}`
                : "Not yet extracted"}
            </p>
            <div className="mt-auto pt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleRefresh(c.id)} className="text-xs text-blue-600 cursor-pointer">
                Refresh Schema
              </button>
              <button onClick={() => handleDelete(c.id)} className="text-xs text-red-600 cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderListView() {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800">
        {paged.map((c) => (
          <div
            key={c.id}
            onContextMenu={(e) => handleContextMenu(e, c.id, c.name)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 group"
          >
            <DbIcon className="w-5 h-5 text-emerald-500 shrink-0" />
            <Link href={`/db/${c.id}`} className="font-medium truncate flex-1">
              {c.name}
            </Link>
            <span className="text-xs text-zinc-500 shrink-0 hidden sm:block">
              {c.host}:{c.port}/{c.databaseName}
            </span>
            <span className="text-xs text-zinc-500 shrink-0 hidden md:block">
              {c.lastExtractedAt
                ? `Extracted: ${new Date(c.lastExtractedAt).toLocaleDateString()}`
                : "Not yet extracted"}
            </span>
            <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleRefresh(c.id)} className="text-xs text-blue-600 cursor-pointer">
                Refresh Schema
              </button>
              <button onClick={() => handleDelete(c.id)} className="text-xs text-red-600 cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">DB Connections</h1>
        <div className="flex gap-2 items-center">
          <ViewToggle value={view} onChange={setView} />
          <SortSelect value={sort} onChange={(v) => { setSort(v); setPage(0); }} />
          <button
            onClick={() => setShowAddDialog(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Connection
          </button>
        </div>
      </div>

      {connections.length === 0 && (
        <p className="text-zinc-500 text-sm">No database connections yet. Add one to get started.</p>
      )}

      {paged.length > 0 && (
        <>
          {view === "grid" ? renderGridView() : renderListView()}
        </>
      )}

      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={sortedConnections.length}
        pageSize={PAGE_SIZE}
      />

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

      <AddConnectionDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={(id) => {
          setShowAddDialog(false);
          triggerRefresh();
          router.push(`/db/${id}`);
        }}
      />
    </div>
  );
}
