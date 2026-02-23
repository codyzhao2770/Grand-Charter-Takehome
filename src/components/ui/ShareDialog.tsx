"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "./Modal";

interface ShareLink {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
  fileName?: string;
}

export default function ShareDialog({ open, onClose, fileId, fileName }: ShareDialogProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadLinks = useCallback(async () => {
    if (!fileId) return;
    const res = await fetch(`/api/files/${fileId}/share`);
    const json = await res.json();
    if (json.data) setLinks(json.data);
  }, [fileId]);

  useEffect(() => {
    if (open && fileId) {
      setNewUrl(null);
      setCopied(false);
      loadLinks();
    }
  }, [open, fileId, loadLinks]);

  async function handleCreate() {
    if (!fileId) return;
    setLoading(true);
    const res = await fetch(`/api/files/${fileId}/share`, { method: "POST" });
    const json = await res.json();
    if (json.data) {
      setNewUrl(json.data.previewUrl);
      setCopied(false);
      loadLinks();
    }
    setLoading(false);
  }

  async function handleRevokeAll() {
    if (!fileId) return;
    await fetch(`/api/files/${fileId}/share`, { method: "DELETE" });
    setLinks([]);
    setNewUrl(null);
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setLinks([]);
    setNewUrl(null);
    setCopied(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} wide>
      <h2 className="text-lg font-semibold mb-1">Share File</h2>
      {fileName && (
        <p className="text-sm text-zinc-500 mb-4 truncate">{fileName}</p>
      )}

      {newUrl && (
        <div className="mb-4">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Share Link</label>
          <div className="flex gap-2 mt-1">
            <input
              readOnly
              value={newUrl}
              className="flex-1 text-sm px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 truncate"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => handleCopy(newUrl)}
              className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Expires in 7 days. Anyone with this link can view the file.</p>
        </div>
      )}

      {!newUrl && (
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
        >
          {loading ? "Generating..." : "Generate Share Link"}
        </button>
      )}

      {links.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Active Links ({links.length})
            </span>
            <button
              onClick={handleRevokeAll}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Revoke All
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-zinc-50 dark:bg-zinc-800"
              >
                <span className="text-zinc-600 dark:text-zinc-400 truncate mr-2">
                  ...{link.token.slice(-12)}
                </span>
                <span className="text-zinc-400 whitespace-nowrap">
                  expires {new Date(link.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
