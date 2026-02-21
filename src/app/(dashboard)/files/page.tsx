"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRefresh } from "@/components/layout/RefreshContext";
import { useToast } from "@/components/layout/ToastContext";
import { useDrag } from "@/components/layout/DragContext";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import UploadDialog from "@/components/ui/UploadDialog";
import { useConfirmDialog, usePromptDialog } from "@/components/ui/useDialog";
import Pagination from "@/components/ui/Pagination";
import SortSelect, { type SortOption } from "@/components/ui/SortSelect";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  createdAt: string;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  _count: { children: number; files: number };
}

type GridItem =
  | { kind: "folder"; data: FolderItem }
  | { kind: "file"; data: FileItem };

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface CtxMenu {
  x: number;
  y: number;
  type: "folder" | "file";
  id: string;
  name: string;
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

export default function FilesPage() {
  const router = useRouter();
  const { refreshKey, triggerRefresh } = useRefresh();
  const toast = useToast();
  const { dragging, setDragging } = useDrag();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const dragCounterRef = useRef(0);

  const confirmDialog = useConfirmDialog();
  const promptDialog = usePromptDialog();

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

  const sortedItems = useMemo(() => {
    const items: GridItem[] = [
      ...folders.map((f) => ({ kind: "folder" as const, data: f })),
      ...files.map((f) => ({ kind: "file" as const, data: f })),
    ];

    items.sort((a, b) => {
      // Folders always before files
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

  async function handleCreateFolder() {
    const name = await promptDialog.prompt({
      title: "New Folder",
      placeholder: "Folder name",
    });
    if (!name) return;
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    loadData();
    triggerRefresh();
  }

  async function handleDeleteFile(id: string) {
    const ok = await confirmDialog.confirm({
      title: "Delete File",
      message: "Are you sure you want to delete this file?",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    loadData();
  }

  async function handleDeleteFolder(id: string) {
    const ok = await confirmDialog.confirm({
      title: "Delete Folder",
      message: "Delete this folder and all its contents? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    loadData();
    triggerRefresh();
  }

  async function handleRenameFile(id: string, currentName: string) {
    const name = await promptDialog.prompt({
      title: "Rename File",
      defaultValue: currentName,
    });
    if (!name || name === currentName) return;
    await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    loadData();
  }

  async function handleRenameFolder(id: string, currentName: string) {
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
    loadData();
    triggerRefresh();
  }

  function handleContextMenu(e: React.MouseEvent, type: "folder" | "file", id: string, name: string) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type, id, name });
  }

  // --- Drag handlers for internal items ---
  function handleDragStart(e: React.DragEvent, type: "file" | "folder", id: string, name: string) {
    e.dataTransfer.setData("application/x-datavault", JSON.stringify({ type, id, name }));
    e.dataTransfer.effectAllowed = "move";
    setDragging({ type, id, name });
  }

  function handleDragEnd() {
    setDragging(null);
    setDropTargetId(null);
  }

  function handleFolderDragOver(e: React.DragEvent, folderId: string) {
    if (e.dataTransfer.types.includes("application/x-datavault")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetId(folderId);
    }
  }

  function handleFolderDragLeave() {
    setDropTargetId(null);
  }

  async function handleFolderDrop(e: React.DragEvent, targetFolderId: string) {
    e.preventDefault();
    setDropTargetId(null);
    const raw = e.dataTransfer.getData("application/x-datavault");
    if (!raw) return;
    const item = JSON.parse(raw) as { type: string; id: string; name: string };
    if (item.id === targetFolderId) return;

    if (item.type === "file") {
      const res = await fetch(`/api/files/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: targetFolderId }),
      });
      if (res.ok) {
        toast.showToast(`Moved "${item.name}" to folder`, "success");
      } else {
        toast.showToast("Failed to move file", "success");
      }
    } else if (item.type === "folder") {
      const res = await fetch(`/api/folders/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: targetFolderId }),
      });
      if (res.ok) {
        toast.showToast(`Moved "${item.name}" to folder`, "success");
      } else {
        toast.showToast("Failed to move folder", "success");
      }
    }
    setDragging(null);
    loadData();
    triggerRefresh();
  }

  // --- Page-level external file drop ---
  function handlePageDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handlePageDragEnter(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      dragCounterRef.current++;
      setExternalDragOver(true);
    }
  }

  function handlePageDragLeave(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setExternalDragOver(false);
      }
    }
  }

  async function handlePageDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setExternalDragOver(false);
    if (!e.dataTransfer.files.length) return;
    const toastId = toast.showToast(`Uploading ${e.dataTransfer.files.length} file(s)...`, "loading");
    for (const file of Array.from(e.dataTransfer.files)) {
      const formData = new FormData();
      formData.append("file", file);
      await fetch("/api/files", { method: "POST", body: formData });
    }
    toast.updateToast(toastId, "Files uploaded successfully", "success");
    loadData();
    triggerRefresh();
  }

  const ctxItems: ContextMenuItem[] = ctxMenu
    ? ctxMenu.type === "folder"
      ? [
          { label: "Open", onClick: () => router.push(`/files/${ctxMenu.id}`) },
          { label: "Download", onClick: () => { window.location.href = `/api/folders/${ctxMenu.id}/download`; } },
          { label: "Rename", onClick: () => handleRenameFolder(ctxMenu.id, ctxMenu.name) },
          { label: "Delete", onClick: () => handleDeleteFolder(ctxMenu.id), variant: "danger" },
        ]
      : [
          { label: "Download", onClick: () => { window.location.href = `/api/files/${ctxMenu.id}`; } },
          { label: "Preview", onClick: () => { window.open(`/api/files/${ctxMenu.id}/preview`, "_blank"); } },
          { label: "Rename", onClick: () => handleRenameFile(ctxMenu.id, ctxMenu.name) },
          { label: "Delete", onClick: () => handleDeleteFile(ctxMenu.id), variant: "danger" },
        ]
    : [];

  const PAGE_SIZE = 12;
  const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pagedItems = sortedItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div
      className="relative"
      onDragOver={handlePageDragOver}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {externalDragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-blue-50/80 dark:bg-blue-950/50 border-2 border-dashed border-blue-500 rounded-lg pointer-events-none">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
            </svg>
            <p className="text-lg font-medium text-blue-600 dark:text-blue-400">Drop files to upload</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Files</h1>
        <div className="flex gap-2">
          <SortSelect value={sort} onChange={(v) => { setSort(v); setPage(0); }} />
          <button
            onClick={handleCreateFolder}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pagedItems.map((item) => {
              if (item.kind === "folder") {
                const f = item.data;
                return (
                  <div
                    key={`folder-${f.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, "folder", f.id, f.name)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleFolderDragOver(e, f.id)}
                    onDragLeave={handleFolderDragLeave}
                    onDrop={(e) => handleFolderDrop(e, f.id)}
                    onContextMenu={(e) => handleContextMenu(e, "folder", f.id, f.name)}
                    className={`border rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group transition-colors flex flex-col items-center justify-center text-center aspect-square ${
                      dropTargetId === f.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : dragging?.id === f.id
                        ? "opacity-50 border-zinc-200 dark:border-zinc-800"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <FolderIcon className="w-10 h-10 mb-3 text-blue-500" />
                    <Link href={`/files/${f.id}`} className="block font-medium truncate w-full px-1">
                      {f.name}
                    </Link>
                    <p className="text-xs text-zinc-500 mt-1">
                      {f._count.children} folders, {f._count.files} files
                    </p>
                    <div className="mt-auto pt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={`/api/folders/${f.id}/download`} className="text-xs text-blue-600">Download</a>
                      <button onClick={() => handleRenameFolder(f.id, f.name)} className="text-xs text-blue-600 cursor-pointer">Rename</button>
                      <button onClick={() => handleDeleteFolder(f.id)} className="text-xs text-red-600 cursor-pointer">Delete</button>
                    </div>
                  </div>
                );
              } else {
                const f = item.data;
                return (
                  <div
                    key={`file-${f.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, "file", f.id, f.name)}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => handleContextMenu(e, "file", f.id, f.name)}
                    className={`border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group flex flex-col items-center justify-center text-center aspect-square ${
                      dragging?.id === f.id && dragging?.type === "file" ? "opacity-50" : ""
                    }`}
                  >
                    <FileIcon className="w-10 h-10 mb-3 text-zinc-400" />
                    <p className="font-medium truncate w-full px-1">{f.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {f.mimeType} &middot; {formatSize(f.size)}
                    </p>
                    <div className="mt-auto pt-2 flex gap-2 flex-wrap justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={`/api/files/${f.id}`} className="text-xs text-blue-600">Download</a>
                      <a href={`/api/files/${f.id}/preview`} target="_blank" className="text-xs text-blue-600">Preview</a>
                      <button onClick={() => handleRenameFile(f.id, f.name)} className="text-xs text-blue-600 cursor-pointer">Rename</button>
                      <button onClick={() => handleDeleteFile(f.id)} className="text-xs text-red-600 cursor-pointer">Delete</button>
                    </div>
                  </div>
                );
              }
            })}
          </div>
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
      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={() => {
          loadData();
          triggerRefresh();
        }}
      />
    </div>
  );
}
