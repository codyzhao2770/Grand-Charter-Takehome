"use client";

import { useState, useRef, useCallback } from "react";
import Modal from "./Modal";
import { formatSize } from "@/lib/format";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  folderId?: string;
  onUploaded: () => void;
}

export default function UploadDialog({ open, onClose, folderId, onUploaded }: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    if (uploading) return;
    setFiles([]);
    setDragOver(false);
    onClose();
  }

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, []);

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      if (folderId) formData.append("folderId", folderId);
      await fetch("/api/files", { method: "POST", body: formData });
    }
    setUploading(false);
    setFiles([]);
    onUploaded();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} wide>
      <h2 className="text-lg font-semibold mb-4">Upload Files</h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
        }`}
      >
        <svg className="w-8 h-8 mx-auto mb-2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
        </svg>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Drag and drop files here, or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 max-h-40 overflow-y-auto space-y-1">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <div className="flex-1 min-w-0">
                <p className="truncate">{f.name}</p>
                <p className="text-xs text-zinc-500">{formatSize(f.size)}</p>
              </div>
              {!uploading && (
                <button onClick={() => removeFile(i)} className="ml-2 text-zinc-400 hover:text-red-500 cursor-pointer">
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={handleClose}
          disabled={uploading}
          className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : `Upload ${files.length > 0 ? `(${files.length})` : ""}`}
        </button>
      </div>
    </Modal>
  );
}
