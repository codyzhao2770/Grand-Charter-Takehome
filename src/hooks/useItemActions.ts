"use client";

import { useConfirmDialog, usePromptDialog } from "@/components/ui/useDialog";
import { useRefresh } from "@/components/layout/RefreshContext";

export function useItemActions(loadData: () => void) {
  const confirmDialog = useConfirmDialog();
  const promptDialog = usePromptDialog();
  const { triggerRefresh } = useRefresh();

  async function deleteFile(id: string) {
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

  async function renameFile(id: string, currentName: string) {
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

  async function deleteFolder(id: string) {
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

  async function renameFolder(id: string, currentName: string) {
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

  async function createFolder(parentId?: string) {
    const name = await promptDialog.prompt({
      title: "New Folder",
      placeholder: "Folder name",
    });
    if (!name) return;
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });
    loadData();
    triggerRefresh();
  }

  return {
    deleteFile,
    renameFile,
    deleteFolder,
    renameFolder,
    createFolder,
    confirmDialog,
    promptDialog,
  };
}
