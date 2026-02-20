"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface FolderDetail {
  id: string;
  name: string;
  parentId: string | null;
  children: { id: string; name: string }[];
  files: FileItem[];
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const router = useRouter();
  const [folder, setFolder] = useState<FolderDetail | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(() => {
    fetch(`/api/folders/${folderId}`)
      .then((r) => r.json())
      .then((d) => setFolder(d.data || null));
  }, [folderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", folderId);
    await fetch("/api/files", { method: "POST", body: formData });
    setUploading(false);
    loadData();
    e.target.value = "";
  }

  async function handleCreateSubfolder() {
    const name = prompt("Folder name:");
    if (!name) return;
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: folderId }),
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
    // If deleting the current folder, navigate up
    if (id === folderId) {
      router.push(folder?.parentId ? `/files/${folder.parentId}` : "/files");
    } else {
      loadData();
    }
  }

  if (!folder) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm text-zinc-500">
        <Link href="/files" className="hover:underline">Files</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{folder.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{folder.name}</h1>
        <div className="flex gap-2">
          <button
            onClick={handleCreateSubfolder}
            className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            New Folder
          </button>
          <label className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
            {uploading ? "Uploading..." : "Upload File"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          <button
            onClick={() => handleDeleteFolder(folderId)}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Folder
          </button>
        </div>
      </div>

      {folder.children.length === 0 && folder.files.length === 0 && (
        <p className="text-zinc-500 text-sm">This folder is empty.</p>
      )}

      {folder.children.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Subfolders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folder.children.map((c) => (
              <Link
                key={c.id}
                href={`/files/${c.id}`}
                className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-medium truncate block"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {folder.files.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Files</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folder.files.map((f) => (
              <div key={f.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 group">
                <p className="font-medium truncate">{f.name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {f.mimeType} &middot; {formatSize(f.size)}
                </p>
                <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={`/api/files/${f.id}`} className="text-xs text-blue-600">Download</a>
                  <a href={`/api/files/${f.id}/preview`} target="_blank" className="text-xs text-blue-600">Preview</a>
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
