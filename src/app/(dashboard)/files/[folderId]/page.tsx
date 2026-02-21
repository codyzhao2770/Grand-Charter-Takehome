"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import type { FileItem, FolderItem, GridItem, CtxMenu, ChildFolder } from "@/lib/types";

const PAGE_SIZE = 12;

interface FolderMeta {
  id: string;
  name: string;
  parentId: string | null;
  breadcrumbs: { id: string; name: string }[];
}

function getSortQuery(sort: SortOption): string {
  switch (sort) {
    case "name-asc":  return "sortBy=name&sortOrder=asc";
    case "name-desc": return "sortBy=name&sortOrder=desc";
    case "recent":    return "sortBy=createdAt&sortOrder=desc";
    case "oldest":    return "sortBy=createdAt&sortOrder=asc";
    default:          return "sortBy=name&sortOrder=asc";
  }
}

export default function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const router = useRouter();
  const { refreshKey } = useRefresh();
  const [folderMeta, setFolderMeta] = useState<FolderMeta | null>(null);
  const [children, setChildren] = useState<ChildFolder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [view, setView] = useState<ViewMode>("grid");
  const [showUpload, setShowUpload] = useState(false);

  const totalsRef = useRef({ folders: 0, files: 0 });

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/folders/${folderId}`).then(r => r.json());
    if (res.data) {
      setFolderMeta({
        id: res.data.id,
        name: res.data.name,
        parentId: res.data.parentId,
        breadcrumbs: res.data.breadcrumbs ?? [],
      });
    }
  }, [folderId]);

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
        ? fetch(`/api/folders?parentId=${folderId}&limit=${fLimit}&offset=${fOffset}&${sq}`).then(r => r.json())
        : null,
      fiLimit > 0
        ? fetch(`/api/files?folderId=${folderId}&limit=${fiLimit}&offset=${fiOffset}&${sq}`).then(r => r.json())
        : null,
    ]);

    const newFolders: ChildFolder[] = fRes?.data ?? [];
    const newFiles: FileItem[] = fiRes?.data ?? [];
    const newFT = fRes?.pagination?.total ?? totalsRef.current.folders;
    const newFiT = fiRes?.pagination?.total ?? totalsRef.current.files;
    totalsRef.current = { folders: newFT, files: newFiT };

    if (page === 0) {
      const foldersToShow = newFolders.slice(0, PAGE_SIZE);
      const remaining = PAGE_SIZE - foldersToShow.length;
      setChildren(foldersToShow);
      setFiles(remaining > 0 ? newFiles.slice(0, remaining) : []);
    } else {
      setChildren(newFolders);
      setFiles(newFiles);
    }
    setTotal(newFT + newFiT);
  }, [page, sort, folderId]);

  useEffect(() => {
    totalsRef.current = { folders: 0, files: 0 };
    setPage(0);
  }, [refreshKey]);

  useEffect(() => {
    loadMeta();
    loadData();
  }, [loadMeta, loadData, refreshKey]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadMeta(), loadData()]);
  }, [loadMeta, loadData]);

  const actions = useItemActions(reloadAll);
  const dragDrop = useFileDragDrop(reloadAll, folderId);

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      await actions.deleteFolder(id);
      if (id === folderId) {
        router.push(folderMeta?.parentId ? `/files/${folderMeta.parentId}` : "/files");
      }
    },
    [actions, folderId, folderMeta?.parentId, router]
  );

  const items: GridItem[] = [
    ...children.map((f) => ({ kind: "folder" as const, data: f })),
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
          { label: "Delete", onClick: () => handleDeleteFolder(ctxMenu.id), variant: "danger" },
        ]
      : [
          { label: "Download", onClick: () => { window.location.href = `/api/files/${ctxMenu.id}`; } },
          { label: "Preview", onClick: () => { window.open(`/api/files/${ctxMenu.id}/preview`, "_blank"); } },
          { label: "Rename", onClick: () => actions.renameFile(ctxMenu.id, ctxMenu.name) },
          { label: "Delete", onClick: () => actions.deleteFile(ctxMenu.id), variant: "danger" },
        ]
    : [];

  if (!folderMeta) {
    return <p className="text-zinc-500">Loading...</p>;
  }

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
    onDeleteFolder: handleDeleteFolder,
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
      {dragDrop.externalDragOver && <DropOverlay label={`Drop files to upload to ${folderMeta.name}`} />}

      <div className="flex items-center gap-2 mb-2 text-sm text-zinc-500 flex-wrap">
        <Link href="/files" className="hover:underline">Files</Link>
        {folderMeta.breadcrumbs?.map((b) => (
          <span key={b.id} className="flex items-center gap-2">
            <span>/</span>
            <Link href={`/files/${b.id}`} className="hover:underline">{b.name}</Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-foreground font-medium">{folderMeta.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(folderMeta.parentId ? `/files/${folderMeta.parentId}` : "/files")}
            className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">{folderMeta.name}</h1>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle value={view} onChange={setView} />
          <SortSelect value={sort} onChange={(v) => { setSort(v); setPage(0); }} />
          <button
            onClick={() => actions.createFolder(folderId)}
            className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            New Folder
          </button>
          <a
            href={`/api/folders/${folderId}/download`}
            className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            Download
          </a>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
          >
            Upload File
          </button>
        </div>
      </div>

      {total === 0 && items.length === 0 && (
        <p className="text-zinc-500 text-sm">This folder is empty.</p>
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
        folderId={folderId}
        onUploaded={reloadAll}
      />
    </div>
  );
}
