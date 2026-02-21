export interface MoveResult {
  ok: boolean;
}

export async function moveItem(
  type: string,
  id: string,
  targetFolderId: string | null
): Promise<MoveResult> {
  if (type === "file") {
    const res = await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: targetFolderId }),
    });
    return { ok: res.ok };
  } else if (type === "folder") {
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: targetFolderId }),
    });
    return { ok: res.ok };
  }
  return { ok: false };
}
