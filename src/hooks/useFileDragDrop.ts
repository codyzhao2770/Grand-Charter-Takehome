"use client";

import { useState, useRef } from "react";
import { useDrag, type DragItem } from "@/components/layout/DragContext";
import { useToast } from "@/components/layout/ToastContext";
import { useRefresh } from "@/components/layout/RefreshContext";
import { moveItem } from "@/lib/move-item";

export function useFileDragDrop(loadData: () => void, folderId?: string) {
  const { dragging, setDragging } = useDrag();
  const toast = useToast();
  const { triggerRefresh } = useRefresh();
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  function handleDragStart(e: React.DragEvent, type: DragItem["type"], id: string, name: string) {
    e.dataTransfer.setData("application/x-datavault", JSON.stringify({ type, id, name }));
    e.dataTransfer.effectAllowed = "move";
    setDragging({ type, id, name });
  }

  function handleDragEnd() {
    setDragging(null);
    setDropTargetId(null);
  }

  function handleFolderDragOver(e: React.DragEvent, targetId: string) {
    if (e.dataTransfer.types.includes("application/x-datavault")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetId(targetId);
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

    const result = await moveItem(item.type, item.id, targetFolderId);
    if (result.ok) {
      toast.showToast(`Moved "${item.name}" to folder`, "success");
    } else {
      toast.showToast(`Failed to move ${item.type}`, "success");
    }
    setDragging(null);
    loadData();
    triggerRefresh();
  }

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
      if (folderId) formData.append("folderId", folderId);
      await fetch("/api/files", { method: "POST", body: formData });
    }
    toast.updateToast(toastId, "Files uploaded successfully", "success");
    loadData();
    triggerRefresh();
  }

  return {
    dragging,
    dropTargetId,
    externalDragOver,
    handleDragStart,
    handleDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
    handlePageDragOver,
    handlePageDragEnter,
    handlePageDragLeave,
    handlePageDrop,
  };
}
