"use client";

import Link from "next/link";
import { FolderIcon, FileIcon } from "@/components/icons";
import { formatSize } from "@/lib/format";
import type { GridItem, FolderItem } from "@/lib/types";
import type { DragItem } from "@/components/layout/DragContext";

interface FileBrowserListProps {
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

export default function FileBrowserList({
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
}: FileBrowserListProps) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800">
      {items.map((item) => {
        if (item.kind === "folder") {
          const f = item.data;
          return (
            <div
              key={`folder-${f.id}`}
              draggable
              onDragStart={(e) => onDragStart(e, "folder", f.id, f.name)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onFolderDragOver(e, f.id)}
              onDragLeave={onFolderDragLeave}
              onDrop={(e) => onFolderDrop(e, f.id)}
              onContextMenu={(e) => onContextMenu(e, "folder", f.id, f.name)}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 group transition-colors ${
                dropTargetId === f.id
                  ? "bg-blue-50 dark:bg-blue-950/30"
                  : dragging?.id === f.id
                  ? "opacity-50"
                  : ""
              }`}
            >
              <FolderIcon className="w-5 h-5 text-blue-500 shrink-0" />
              <Link href={`/files/${f.id}`} className="font-medium truncate flex-1">
                {f.name}
              </Link>
              {isFolderItem(f) && (
                <span className="text-xs text-zinc-500 shrink-0 hidden sm:block">
                  {f._count.children} folders, {f._count.files} files
                </span>
              )}
              <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
              onDragStart={(e) => onDragStart(e, "file", f.id, f.name)}
              onDragEnd={onDragEnd}
              onContextMenu={(e) => onContextMenu(e, "file", f.id, f.name)}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 group ${
                dragging?.id === f.id && dragging?.type === "file" ? "opacity-50" : ""
              }`}
            >
              <FileIcon className="w-5 h-5 text-zinc-400 shrink-0" />
              <p className="font-medium truncate flex-1">{f.name}</p>
              <span className="text-xs text-zinc-500 shrink-0 hidden sm:block">
                {formatSize(f.size)}
              </span>
              <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={`/api/files/${f.id}`} className="text-xs text-blue-600">Download</a>
                <a href={`/api/files/${f.id}/preview`} target="_blank" className="text-xs text-blue-600">Preview</a>
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
