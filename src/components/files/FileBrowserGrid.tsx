"use client";

import { useRouter } from "next/navigation";
import { FolderIcon, FileIcon } from "@/components/icons";
import { formatSize } from "@/lib/format";
import type { GridItem, FolderItem } from "@/lib/types";
import type { DragItem } from "@/components/layout/DragContext";

interface FileBrowserGridProps {
  items: GridItem[];
  dragging: DragItem | null;
  dropTargetId: string | null;
  onDragStart: (e: React.DragEvent, type: "file" | "folder", id: string, name: string) => void;
  onDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, folderId: string) => void;
  onFolderDragLeave: () => void;
  onFolderDrop: (e: React.DragEvent, folderId: string) => void;
  onContextMenu: (e: React.MouseEvent, type: "folder" | "file", id: string, name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFile: (id: string, name: string) => void;
  onDeleteFile: (id: string) => void;
}

function isFolderItem(data: GridItem["data"]): data is FolderItem {
  return "_count" in data;
}

export default function FileBrowserGrid({
  items,
  dragging,
  dropTargetId,
  onDragStart,
  onDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  onContextMenu,
  onRenameFolder,
  onDeleteFolder,
  onRenameFile,
  onDeleteFile,
}: FileBrowserGridProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => {
        if (item.kind === "folder") {
          const f = item.data;
          return (
            <div
              key={`folder-${f.id}`}
              draggable
              onClick={() => router.push(`/files/${f.id}`)}
              onDragStart={(e) => onDragStart(e, "folder", f.id, f.name)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onFolderDragOver(e, f.id)}
              onDragLeave={onFolderDragLeave}
              onDrop={(e) => onFolderDrop(e, f.id)}
              onContextMenu={(e) => onContextMenu(e, "folder", f.id, f.name)}
              className={`border rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group transition-colors flex flex-col items-center justify-center text-center aspect-square cursor-pointer ${
                dropTargetId === f.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : dragging?.id === f.id
                  ? "opacity-50 border-zinc-200 dark:border-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <FolderIcon className="w-10 h-10 mb-3 text-blue-500" />
              <span className="block font-medium truncate w-full px-1">
                {f.name}
              </span>
              {isFolderItem(f) && (
                <p className="text-xs text-zinc-500 mt-1">
                  {f._count.children} folders, {f._count.files} files
                </p>
              )}
              <div className="mt-auto pt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <a href={`/api/folders/${f.id}/download`} className="text-xs text-blue-600">Download</a>
                <button onClick={() => onRenameFolder(f.id, f.name)} className="text-xs text-blue-600 cursor-pointer">Rename</button>
                <button onClick={() => onDeleteFolder(f.id)} className="text-xs text-red-600 cursor-pointer">Delete</button>
              </div>
            </div>
          );
        } else {
          const f = item.data;
          return (
            <div
              key={`file-${f.id}`}
              draggable
              onClick={() => window.open(`/api/files/${f.id}/preview`, "_blank")}
              onDragStart={(e) => onDragStart(e, "file", f.id, f.name)}
              onDragEnd={onDragEnd}
              onContextMenu={(e) => onContextMenu(e, "file", f.id, f.name)}
              className={`border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group flex flex-col items-center justify-center text-center aspect-square cursor-pointer ${
                dragging?.id === f.id && dragging?.type === "file" ? "opacity-50" : ""
              }`}
            >
              <FileIcon className="w-10 h-10 mb-3 text-zinc-400" />
              <p className="font-medium truncate w-full px-1">{f.name}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {f.mimeType} &middot; {formatSize(f.size)}
              </p>
              <div className="mt-auto pt-2 flex gap-2 flex-wrap justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <a href={`/api/files/${f.id}`} className="text-xs text-blue-600">Download</a>
                <button onClick={() => onRenameFile(f.id, f.name)} className="text-xs text-blue-600 cursor-pointer">Rename</button>
                <button onClick={() => onDeleteFile(f.id)} className="text-xs text-red-600 cursor-pointer">Delete</button>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
