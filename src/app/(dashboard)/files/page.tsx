"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRefresh } from "@/components/layout/RefreshContext";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import UploadDialog from "@/components/ui/UploadDialog";
import Pagination from "@/components/ui/Pagination";
import SortSelect, { type SortOption } from "@/components/ui/SortSelect";
import ViewToggle, { type ViewMode } from "@/components/ui/ViewToggle";
import FileBrowserGrid from "@/components/files/FileBrowserGrid";
import FileBrowserList from "@/components/files/FileBrowserList";
import DropOverlay from "@/components/files/DropOverlay";
import { useItemActions } from "@/hooks/useItemActions";
import { useFileDragDrop } from "@/hooks/useFileDragDrop";
import type { FileItem, FolderItem, GridItem, CtxMenu } from "@/lib/types";

const PAGE_SIZE = 12;

export default function FilesPage() {
  const router = useRouter();
  const { refreshKey } = useRefresh();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [view, setView] = useState<ViewMode>("grid");
  const [showUpload, setShowUpload] = useState(false);

  const loadData = useCallback(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((d) => setFolders(d.data || []));
    fetch("/api/files")
      .then((r) => r.json())
      .then((d) => setFiles(d.data || []));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const actions = useItemActions(loadData);
  const dragDrop = useFileDragDrop(loadData);

  const sortedItems = useMemo(() => {
    const items: GridItem[] = [
      ...folders.map((f) => ({ kind: "folder" as const, data: f })),
      ...files.map((f) => ({ kind: "file" as const, data: f })),
    ];

    items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      switch (sort) {
        case "name-asc":
          return a.data.name.localeCompare(b.data.name);
        case "name-desc":
          return b.data.name.localeCompare(a.data.name);
        case "recent":
          return new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime();
        case "oldest":
          return new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime();
        default:
          return 0;
      }
    });

    return items;
  }, [folders, files, sort]);

  function handleContextMenu(e: React.MouseEvent, type: "folder" | "file", id: string, name: string) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type, id, name });
  }

  const ctxItems: ContextMenuItem[] = ctxMenu
    ? ctxMenu.type === "folder"
      ? [
          { label: "Open", onClick: () => router.push(`/files/${ctxMenu.id}`) },
          { label: "Download", onClick: () => { window.location.href = `/api/folders/${ctxMenu.id}/download`; } },
          { label: "Rename", onClick: () => actions.renameFolder(ctxMenu.id, ctxMenu.name) },
          { label: "Delete", onClick: () => actions.deleteFolder(ctxMenu.id), variant: "danger" },
        ]
      : [
          { label: "Download", onClick: () => { window.location.href = `/api/files/${ctxMenu.id}`; } },
          { label: "Preview", onClick: () => { window.open(`/api/files/${ctxMenu.id}/preview`, "_blank"); } },
          { label: "Rename", onClick: () => actions.renameFile(ctxMenu.id, ctxMenu.name) },
          { label: "Delete", onClick: () => actions.deleteFile(ctxMenu.id), variant: "danger" },
        ]
    : [];

  const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pagedItems = sortedItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const viewProps = {
    items: pagedItems,
    dragging: dragDrop.dragging,
    dropTargetId: dragDrop.dropTargetId,
    onDragStart: dragDrop.handleDragStart,
    onDragEnd: dragDrop.handleDragEnd,
    onFolderDragOver: dragDrop.handleFolderDragOver,
    onFolderDragLeave: dragDrop.handleFolderDragLeave,
    onFolderDrop: dragDrop.handleFolderDrop,
    onContextMenu: handleContextMenu,
    onRenameFolder: actions.renameFolder,
    onDeleteFolder: actions.deleteFolder,
    onRenameFile: actions.renameFile,
    onDeleteFile: actions.deleteFile,
  };

  return (
    <div
      className="relative"
      onDragOver={dragDrop.handlePageDragOver}
      onDragEnter={dragDrop.handlePageDragEnter}
      onDragLeave={dragDrop.handlePageDragLeave}
      onDrop={dragDrop.handlePageDrop}
    >
      {dragDrop.externalDragOver && <DropOverlay />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Files</h1>
        <div className="flex gap-2 items-center">
          <ViewToggle value={view} onChange={setView} />
          <SortSelect value={sort} onChange={(v) => { setSort(v); setPage(0); }} />
          <button
            onClick={() => actions.createFolder()}
            className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            New Folder
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
          >
            Upload File
          </button>
        </div>
      </div>

      {sortedItems.length === 0 && (
        <p className="text-zinc-500 text-sm">No files or folders yet. Upload a file or create a folder to get started.</p>
      )}

      {pagedItems.length > 0 && (
        <>
          {view === "grid" ? <FileBrowserGrid {...viewProps} /> : <FileBrowserList {...viewProps} />}
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={sortedItems.length} pageSize={PAGE_SIZE} />
        </>
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxItems}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <ConfirmDialog
        open={actions.confirmDialog.state.open}
        title={actions.confirmDialog.state.title}
        message={actions.confirmDialog.state.message}
        confirmLabel={actions.confirmDialog.state.confirmLabel}
        variant={actions.confirmDialog.state.variant}
        onConfirm={actions.confirmDialog.onConfirm}
        onCancel={actions.confirmDialog.onCancel}
      />
      <PromptDialog
        open={actions.promptDialog.state.open}
        title={actions.promptDialog.state.title}
        defaultValue={actions.promptDialog.state.defaultValue}
        placeholder={actions.promptDialog.state.placeholder}
        confirmLabel={actions.promptDialog.state.confirmLabel}
        onConfirm={actions.promptDialog.onConfirm}
        onCancel={actions.promptDialog.onCancel}
      />
      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={loadData}
      />
    </div>
  );
}
