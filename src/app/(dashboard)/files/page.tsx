"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

function getSortQuery(sort: SortOption): string {
  switch (sort) {
    case "name-asc":  return "sortBy=name&sortOrder=asc";
    case "name-desc": return "sortBy=name&sortOrder=desc";
    case "recent":    return "sortBy=createdAt&sortOrder=desc";
    case "oldest":    return "sortBy=createdAt&sortOrder=asc";
    default:          return "sortBy=name&sortOrder=asc";
  }
}

export default function FilesPage() {
  const router = useRouter();
  const { refreshKey } = useRefresh();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [view, setView] = useState<ViewMode>("grid");
  const [showUpload, setShowUpload] = useState(false);

  const totalsRef = useRef({ folders: 0, files: 0 });

  const loadData = useCallback(async () => {
    const offset = page * PAGE_SIZE;
    const sq = getSortQuery(sort);
    const ft = totalsRef.current.folders;

    let fOffset = 0, fLimit = 0;
    let fiOffset = 0, fiLimit = 0;

    if (page === 0) {
      fLimit = PAGE_SIZE;
      fiLimit = PAGE_SIZE;
    } else if (offset < ft) {
      fOffset = offset;
      fLimit = Math.min(PAGE_SIZE, ft - offset);
      fiOffset = 0;
      fiLimit = PAGE_SIZE - fLimit;
    } else {
      fiOffset = offset - ft;
      fiLimit = PAGE_SIZE;
    }

    const [fRes, fiRes] = await Promise.all([
      fLimit > 0
        ? fetch(`/api/folders?limit=${fLimit}&offset=${fOffset}&${sq}`).then(r => r.json())
        : null,
      fiLimit > 0
        ? fetch(`/api/files?limit=${fiLimit}&offset=${fiOffset}&${sq}`).then(r => r.json())
        : null,
    ]);

    const newFolders: FolderItem[] = fRes?.data ?? [];
    const newFiles: FileItem[] = fiRes?.data ?? [];
    const newFT = fRes?.pagination?.total ?? totalsRef.current.folders;
    const newFiT = fiRes?.pagination?.total ?? totalsRef.current.files;
    totalsRef.current = { folders: newFT, files: newFiT };

    if (page === 0) {
      const foldersToShow = newFolders.slice(0, PAGE_SIZE);
      const remaining = PAGE_SIZE - foldersToShow.length;
      setFolders(foldersToShow);
      setFiles(remaining > 0 ? newFiles.slice(0, remaining) : []);
    } else {
      setFolders(newFolders);
      setFiles(newFiles);
    }
    setTotal(newFT + newFiT);
  }, [page, sort]);

  useEffect(() => {
    totalsRef.current = { folders: 0, files: 0 };
    setPage(0);
  }, [refreshKey]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const actions = useItemActions(loadData);
  const dragDrop = useFileDragDrop(loadData);

  const items: GridItem[] = [
    ...folders.map((f) => ({ kind: "folder" as const, data: f })),
    ...files.map((f) => ({ kind: "file" as const, data: f })),
  ];

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

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));

  const viewProps = {
    items,
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

      {total === 0 && items.length === 0 && (
        <p className="text-zinc-500 text-sm">No files or folders yet. Upload a file or create a folder to get started.</p>
      )}

      {items.length > 0 && (
        <>
          {view === "grid" ? <FileBrowserGrid {...viewProps} /> : <FileBrowserList {...viewProps} />}
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />
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
