"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

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
  _count: { children: number; files: number };
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [uploading, setUploading] = useState(false);

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
  }, [loadData]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await fetch("/api/files", { method: "POST", body: formData });
    setUploading(false);
    loadData();
    e.target.value = "";
  }

  async function handleCreateFolder() {
    const name = prompt("Folder name:");
    if (!name) return;
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    loadData();
  }

  async function handleDeleteFile(id: string) {
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    loadData();
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Delete this folder and all its contents?")) return;
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    loadData();
  }

  async function handleRenameFile(id: string, currentName: string) {
    const name = prompt("New name:", currentName);
    if (!name || name === currentName) return;
    await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    loadData();
  }

  async function handleRenameFolder(id: string, currentName: string) {
    const name = prompt("New name:", currentName);
    if (!name || name === currentName) return;
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    loadData();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Files</h1>
        <div className="flex gap-2">
          <button
            onClick={handleCreateFolder}
            className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            New Folder
          </button>
          <label className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
            {uploading ? "Uploading..." : "Upload File"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {folders.length === 0 && files.length === 0 && (
        <p className="text-zinc-500 text-sm">No files or folders yet. Upload a file or create a folder to get started.</p>
      )}

      {folders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Folders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folders.map((f) => (
              <div key={f.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group">
                <Link href={`/files/${f.id}`} className="block font-medium truncate">
                  {f.name}
                </Link>
                <p className="text-xs text-zinc-500 mt-1">
                  {f._count.children} folders, {f._count.files} files
                </p>
                <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleRenameFolder(f.id, f.name)} className="text-xs text-blue-600">Rename</button>
                  <button onClick={() => handleDeleteFolder(f.id)} className="text-xs text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Files</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((f) => (
              <div key={f.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group">
                <p className="font-medium truncate">{f.name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {f.mimeType} &middot; {formatSize(f.size)}
                </p>
                <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={`/api/files/${f.id}`} className="text-xs text-blue-600">Download</a>
                  <a href={`/api/files/${f.id}/preview`} target="_blank" className="text-xs text-blue-600">Preview</a>
                  <button onClick={() => handleRenameFile(f.id, f.name)} className="text-xs text-blue-600">Rename</button>
                  <button onClick={() => handleDeleteFile(f.id)} className="text-xs text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
