"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRefresh } from "@/components/layout/RefreshContext";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AddConnectionDialog from "@/components/ui/AddConnectionDialog";
import { useConfirmDialog } from "@/components/ui/useDialog";
import Pagination from "@/components/ui/Pagination";

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
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [page, setPage] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const confirmDialog = useConfirmDialog();

  const loadData = useCallback(() => {
    fetch("/api/db-connections")
      .then((r) => r.json())
      .then((d) => setConnections(d.data || []));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

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
    const res = await fetch(`/api/db-connections/${id}/extract`, { method: "POST" });
    loadData();
    if (res.ok) {
      setToast("Schema refreshed successfully");
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleContextMenu(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, id, name });
  }

  const totalPages = Math.ceil(connections.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = connections.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const ctxItems: ContextMenuItem[] = ctxMenu
    ? [
        { label: "Open", onClick: () => router.push(`/db/${ctxMenu.id}`) },
        { label: "Refresh Schema", onClick: () => handleRefresh(ctxMenu.id) },
        { label: "Delete", onClick: () => handleDelete(ctxMenu.id), variant: "danger" },
      ]
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">DB Connections</h1>
        <button
          onClick={() => setShowAddDialog(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Connection
        </button>
      </div>

      {connections.length === 0 && (
        <p className="text-zinc-500 text-sm">No database connections yet. Add one to get started.</p>
      )}

      {paged.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paged.map((c) => (
            <div
              key={c.id}
              onContextMenu={(e) => handleContextMenu(e, c.id, c.name)}
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group"
            >
              <Link href={`/db/${c.id}`} className="block font-medium truncate">
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
              <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
      )}

      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={connections.length}
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

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-in fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
