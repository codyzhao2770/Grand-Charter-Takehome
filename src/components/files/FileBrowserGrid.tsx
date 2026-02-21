"use client";

import { useRouter } from "next/navigation";
import { FolderIcon } from "@/components/icons";
import { formatSize } from "@/lib/format";
import FileThumbnail from "@/components/files/FileThumbnail";
import type { GridItem, FolderItem, FileItem } from "@/lib/types";
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

function isFileItem(data: GridItem["data"]): data is FileItem {
  return "mimeType" in data;
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : "";
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
              className={`border rounded-lg overflow-hidden hover:bg-zinc-50 dark:hover:bg-zinc-900 group transition-colors flex flex-col cursor-pointer ${
                dropTargetId === f.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : dragging?.id === f.id
                  ? "opacity-50 border-zinc-200 dark:border-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex-1 flex items-center justify-center bg-blue-50 dark:bg-blue-950/20 min-h-[100px]">
                <FolderIcon className="w-14 h-14 text-blue-500" />
              </div>
              <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
                <p className="font-medium text-sm truncate" title={f.name}>
                  {f.name}
                </p>
                {isFolderItem(f) && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {f._count.children + f._count.files} items
                  </p>
                )}
                <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <a href={`/api/folders/${f.id}/download`} className="text-xs text-blue-600">Download</a>
                  <button onClick={() => onRenameFolder(f.id, f.name)} className="text-xs text-blue-600 cursor-pointer">Rename</button>
                  <button onClick={() => onDeleteFolder(f.id)} className="text-xs text-red-600 cursor-pointer">Delete</button>
                </div>
              </div>
            </div>
          );
        } else {
          const f = item.data;
          const ext = fileExtension(f.name);
          return (
            <div
              key={`file-${f.id}`}
              draggable
              onClick={() => window.open(`/api/files/${f.id}/preview`, "_blank")}
              onDragStart={(e) => onDragStart(e, "file", f.id, f.name)}
              onDragEnd={onDragEnd}
              onContextMenu={(e) => onContextMenu(e, "file", f.id, f.name)}
              className={`border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden group flex flex-col cursor-pointer transition-shadow hover:shadow-md ${
                dragging?.id === f.id && dragging?.type === "file" ? "opacity-50" : ""
              }`}
            >
              {isFileItem(f) && (
                <FileThumbnail
                  fileId={f.id}
                  fileName={f.name}
                  mimeType={f.mimeType}
                  className="flex-1 min-h-[100px]"
                />
              )}
              <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <p className="font-medium text-sm truncate" title={f.name}>
                  {f.name}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {ext && <span className="font-medium">{ext}</span>}
                  {ext && " · "}
                  {isFileItem(f) && formatSize(f.size)}
                </p>
                <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <a href={`/api/files/${f.id}`} className="text-xs text-blue-600">Download</a>
                  <button onClick={() => onRenameFile(f.id, f.name)} className="text-xs text-blue-600 cursor-pointer">Rename</button>
                  <button onClick={() => onDeleteFile(f.id)} className="text-xs text-red-600 cursor-pointer">Delete</button>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
